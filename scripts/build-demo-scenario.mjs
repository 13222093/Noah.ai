/**
 * Build the 1 January 2020 historical-replay scenario for the operator demo
 * (lib/ops/demo/, docs/demo/simulation.md). Dependency-free.
 *
 *   node scripts/build-demo-scenario.mjs            # uses the cached rain response if present
 *   node scripts/build-demo-scenario.mjs --refresh  # re-fetch rain from Open-Meteo (one request)
 *
 * Inputs
 *   ml-service/data/tma_2020.xlsx.csv   REAL DSDA water levels (S2 archive), mm, WIB wall clock
 *   config/stations.yaml                station ids, rivers, 2020 Siaga thresholds (evidence.s2_2020)
 *   config/polder_candidates.yaml       polder reference points, nearest posts, pump evidence
 *   Open-Meteo historical archive       ERA5 hourly precipitation at each polder reference point
 *
 * Output
 *   lib/ops/demo/scenario-2020-01-01.json
 *   lib/ops/demo/raw/open-meteo-era5-2019-12-30_2020-01-02.json  (raw response, fetched once)
 *
 * Rules: water level converted mm -> cm here (the only conversion point);
 * WIB wall-clock -> UTC here; readings are flagged, never dropped (except exact
 * duplicate rows of the same post and timestamp, which are scrape repeats).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CSV_PATH = join(ROOT, 'ml-service/data/tma_2020.xlsx.csv');
const STATIONS_PATH = join(ROOT, 'config/stations.yaml');
const POLDERS_PATH = join(ROOT, 'config/polder_candidates.yaml');
const OUT_DIR = join(ROOT, 'lib/ops/demo');
const OUT_PATH = join(OUT_DIR, 'scenario-2020-01-01.json');
const RAW_DIR = join(OUT_DIR, 'raw');
const RAW_RAIN_PATH = join(RAW_DIR, 'open-meteo-era5-2019-12-30_2020-01-02.json');

/** Scenario window, WIB wall clock (converted to UTC below). */
export const WINDOW_WIB = { start: '2019-12-31 00:00', end: '2020-01-02 12:00' };
export const STEP_MIN = 10;
const RAIN_START_DATE = '2019-12-30';
const RAIN_END_DATE = '2020-01-02';

export const SOURCES = {
  levels: {
    kind: 'historical',
    source: 'DSDA Posko Banjir (arsip S2)',
    file: 'ml-service/data/tma_2020.xlsx.csv',
    note: 'Arsip TMA DSDA 2020 (S2), interval ~30 menit, mm pada nol papan duga; status_siaga dicatat DSDA. Zona waktu diasumsikan WIB (GAP_REPORT Ari Q5, DSDA Q3 masih terbuka).',
  },
  rain: {
    kind: 'reanalysis',
    source: 'Open-Meteo ERA5 (reanalisis, resolusi kasar)',
    model: 'era5',
    licence: 'Open-Meteo data CC BY 4.0; ERA5 (Copernicus Climate Change Service)',
    note: 'Grid ERA5 ~0,25 derajat (~28 km); nilai per jam = hujan pada jam itu. ERA5 diketahui meremehkan hujan ekstrem lokal.',
  },
};

// ---------------------------------------------------------------------------
// Pure helpers (exported for lib/ops/demo/*.test.ts)
// ---------------------------------------------------------------------------

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** "2020-01-01 23:40:00" (Asia/Jakarta wall clock) -> "2020-01-01T16:40:00.000Z". */
export function wibToUtcIso(wib) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(wib.trim());
  if (!m) throw new RangeError(`Invalid WIB timestamp: ${wib}`);
  const [, y, mo, d, h, mi, s] = m;
  const ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, s ? +s : 0) - WIB_OFFSET_MS;
  return new Date(ms).toISOString();
}

/** DSDA archive millimetres -> centimetres (one decimal). */
export function mmToCm(mm) {
  if (mm === null || mm === undefined || Number.isNaN(mm)) return null;
  return Math.round(mm) / 10;
}

/** "Status : Siaga 2" -> "siaga2". */
export function mapSiaga(label) {
  const s = String(label ?? '').toLowerCase();
  if (/normal/.test(s)) return 'normal';
  const m = /siaga\s*([123])/.exec(s);
  return m ? `siaga${m[1]}` : 'unknown';
}

const CSV_RE = /^"([^"]*)",("[^"]*"|[^,]*),([^,]*),([^,]*),"([^"]*)",([^,]*),"([^"]*)"$/;

/** Parse the S2 CSV into rows. Unparseable lines are reported, not silently skipped. */
export function parseTmaCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
  const rows = [];
  const bad = [];
  for (const line of lines.slice(1)) {
    const m = CSV_RE.exec(line);
    if (!m) {
      bad.push(line);
      continue;
    }
    rows.push({
      label: m[1].trim(),
      lokasi: m[2].replace(/"/g, '').trim(),
      lat: Number(m[3]),
      lon: Number(m[4]),
      wib: m[5],
      mm: m[6] === '' ? null : Number(m[6]),
      status: m[7],
    });
  }
  return { rows, bad };
}

/**
 * Quality flags for one post's series (flag, never drop).
 * - negative reading where the post does not allow negatives -> suspect
 * - isolated spike: >= spikeCm away from both neighbours on the same side,
 *   neighbours within maxGapMin -> suspect
 * - stuck sensor: >= 6 readings over >= 6 h, all identical -> every point suspect
 */
export function qcSeries(points, { spikeCm = 100, maxGapMin = 180, allowsNegative = false } = {}) {
  const out = points.map((p) => ({ ...p, quality: 'ok' }));
  const spikeTs = [];
  const negativeTs = [];
  for (let i = 0; i < out.length; i += 1) {
    const p = out[i];
    if (p.cm === null) continue;
    if (!allowsNegative && p.cm < 0) {
      p.quality = 'suspect';
      negativeTs.push(p.ts);
    }
    if (i > 0 && i < out.length - 1) {
      const a = out[i - 1];
      const b = out[i + 1];
      if (a.cm === null || b.cm === null) continue;
      const gapA = (Date.parse(p.ts) - Date.parse(a.ts)) / 60000;
      const gapB = (Date.parse(b.ts) - Date.parse(p.ts)) / 60000;
      const dA = p.cm - a.cm;
      const dB = p.cm - b.cm;
      const sameSide = Math.sign(dA) === Math.sign(dB) && dA !== 0;
      const bothFar = Math.abs(dA) >= spikeCm && Math.abs(dB) >= spikeCm;
      // Demo addition: neighbours agree (within a quarter of the deviation) and the point is
      // >= half the spike threshold away from both, e.g. Depok 163 -> 75 -> 157 cm.
      const dev = Math.min(Math.abs(dA), Math.abs(dB));
      const isolated = dev >= spikeCm / 2 && Math.abs(a.cm - b.cm) <= dev / 4;
      if (gapA <= maxGapMin && gapB <= maxGapMin && sameSide && (bothFar || isolated)) {
        p.quality = 'suspect';
        spikeTs.push(p.ts);
      }
    }
  }
  const values = out.filter((p) => p.cm !== null).map((p) => p.cm);
  const spanH = out.length > 1 ? (Date.parse(out[out.length - 1].ts) - Date.parse(out[0].ts)) / 3600000 : 0;
  const stuck = values.length >= 6 && spanH >= 6 && new Set(values).size === 1;
  if (stuck) for (const p of out) p.quality = 'suspect';
  return { points: out, stuck, stuckValueCm: stuck ? values[0] : null, spikeTs, negativeTs };
}

/**
 * 2020 Siaga thresholds from evidence.s2_2020. Per level: the derived value
 * if the 2020 labels pin it down; otherwise today's DSDA value if it is
 * consistent with the 2020 bracket (max_below < v <= min_at); otherwise null.
 */
export function thresholds2020(st) {
  const levels = ['siaga3', 'siaga2', 'siaga1'];
  const res = { siaga3: null, siaga2: null, siaga1: null };
  const how = [];
  for (const lv of levels) {
    const ev = st.s2_2020?.[lv];
    const current = st.current?.[lv] ?? null;
    if (ev && ev.value_cm !== null && ev.value_cm !== undefined) {
      res[lv] = ev.value_cm;
      how.push('s2');
      continue;
    }
    if (ev && current !== null && !/overlap/.test(ev.result ?? '')) {
      const okLow = ev.max_below_cm === null || current > ev.max_below_cm;
      const okHigh = ev.min_at_cm === null || current <= ev.min_at_cm;
      if (okLow && okHigh) {
        res[lv] = current;
        how.push('page');
        continue;
      }
    }
    if (!ev && st.currentSource === 'dsda_official' && current !== null) {
      res[lv] = current;
      how.push('official');
      continue;
    }
    how.push('null');
  }
  let source;
  if (st.currentSource === 'dsda_official' && how.every((h) => h === 's2' || h === 'official')) {
    source = 'dsda_official (sama dengan label S2 2020)';
  } else if (how.every((h) => h === 'null')) {
    source = 'tidak diketahui untuk 2020';
  } else if (how.every((h) => h === 's2' || h === 'null')) {
    source = 'derived_from_S2_2020';
  } else {
    source = `derived_from_S2_2020 + ${st.currentSource ?? 'dsda'} (nilai sekarang yang konsisten dengan label 2020)`;
  }
  return { ...res, source };
}

// ---------------------------------------------------------------------------
// Minimal line-based readers for the two YAML files (fixed, known layout)
// ---------------------------------------------------------------------------

function unquote(s) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

/** Parse a flow map like {a: 1, b: "x, y", c: null}. */
export function parseFlowMap(s) {
  const body = s.trim().replace(/^\{/, '').replace(/\}$/, '');
  const out = {};
  const re = /\s*([A-Za-z0-9_]+):\s*("(?:[^"\\]|\\.)*"|[^,]*)\s*(?:,|$)/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    if (m[0] === '') break;
    const raw = m[2].trim();
    let v;
    if (raw === 'null' || raw === '~' || raw === '') v = null;
    else if (raw.startsWith('"')) v = raw.slice(1, -1);
    else if (raw === 'true' || raw === 'false') v = raw === 'true';
    else if (!Number.isNaN(Number(raw))) v = Number(raw);
    else v = raw;
    out[m[1]] = v;
  }
  return out;
}

export function readStationsYaml(text) {
  const stations = [];
  const qc = {};
  let cur = null;
  let inQc = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    if (/^qc:/.test(line)) inQc = true;
    else if (/^\S/.test(line)) inQc = false;
    if (inQc) {
      const m = /^\s+(spike_cm|spike_max_gap_minutes):\s*(\d+)/.exec(line);
      if (m) qc[m[1]] = Number(m[2]);
      continue;
    }
    let m = /^ {2}- code:\s*(\S+)/.exec(line);
    if (m) {
      cur = { code: m[1], current: {}, s2_2020: null, aliases: [] };
      stations.push(cur);
      continue;
    }
    if (!cur) continue;
    if ((m = /^ {4}name:\s*(.+)$/.exec(line))) cur.name = unquote(m[1]);
    else if ((m = /^ {4}river:\s*(.+)$/.exec(line))) cur.river = unquote(m[1]);
    else if (/^ {4}source:\s*s2_opendata/.test(line)) cur.homeS2 = true;
    else if ((m = /^ {4}external_id:\s*("[^"]*"|\S+)/.exec(line)) && cur.homeS2) cur.aliases.push(unquote(m[1]));
    else if ((m = /^ {4}allows_negative:\s*(true|false)/.exec(line))) cur.allowsNegative = m[1] === 'true';
    else if ((m = /^ {6}- (\{.*source:\s*s2_opendata.*\})/.exec(line))) cur.aliases.push(parseFlowMap(m[1]).external_id);
    else if ((m = /^ {6}source:\s*(\S+)/.exec(line))) cur.currentSource = m[1] === 'null' ? null : m[1];
    else if ((m = /^ {6}siaga_([123])_cm:\s*(\S+)/.exec(line))) cur.current[`siaga${m[1]}`] = m[2] === 'null' ? null : Number(m[2]);
    else if (/^ {8}s2_2020:/.test(line)) cur.s2_2020 = {};
    else if ((m = /^ {10}siaga_([123]):\s*(\{.*\})/.exec(line)) && cur.s2_2020) cur.s2_2020[`siaga${m[1]}`] = parseFlowMap(m[2]);
  }
  return { stations, qc };
}

export function readPolderCandidatesYaml(text) {
  const out = [];
  let cur = null;
  let section = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    if (/^\S/.test(line)) {
      section = line.replace(/:.*/, '');
      cur = null;
      continue;
    }
    if (section !== 'candidates') continue;
    let m = /^ {2}- id:\s*(\S+)/.exec(line);
    if (m) {
      cur = { id: m[1], nearestPosts: [], evidence: {} };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    if ((m = /^ {4}name:\s*(.+)$/.exec(line))) cur.name = unquote(m[1]);
    else if ((m = /^ {4}admin:\s*(.+)$/.exec(line))) cur.admin = unquote(m[1]);
    else if ((m = /^ {4}ref_point:\s*(\{.*\})/.exec(line))) cur.refPoint = parseFlowMap(m[1]);
    else if ((m = /^ {6}- (\{post:.*\})/.exec(line))) cur.nearestPosts.push(parseFlowMap(m[1]));
    else if ((m = /^ {6}(c\d):\s*(.+)$/.exec(line))) cur.evidence[m[1]] = unquote(m[2]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Polder demo metadata. Pump capacities ONLY where config/polder_candidates.yaml
// evidence states them; otherwise capacityM3s: null (the engine then uses the
// placeholder documented in lib/ops/demo/engine.ts SIM_ASSUMPTIONS).
// ---------------------------------------------------------------------------

const POLDER_DEMO = {
  pulomas: {
    shortName: 'Polder Pulomas',
    displayRadiusM: 750,
    pumps: [
      { id: 'pulomas_p1', name: 'Pompa 1 (Pulomas 2)', capacityM3s: null },
      { id: 'pulomas_p2', name: 'Pompa 2 (Pulomas 2)', capacityM3s: null },
      { id: 'pulomas_p3', name: 'Pompa 3 (Pulomas 2)', capacityM3s: null },
    ],
    pumpNote: 'Jumlah 3 pompa dari R1 (2024); kapasitas per pompa tidak konsisten di sumber (R5: rencana total 5,5 m3/s), jadi tidak dipakai. Kondisi 2020 belum diketahui.',
  },
  sunter_selatan: {
    shortName: 'Polder Sunter Selatan',
    displayRadiusM: 800,
    pumps: [{ id: 'sunter_selatan_agg', name: 'Pompa Waduk Sunter Selatan (jumlah dan kapasitas belum diketahui)', capacityM3s: null }],
    pumpNote: 'Pompa Sunter Selatan sendiri belum diketahui. Rumah Pompa Sunter C (3 x 2,0 m3/s, 2025) tidak dimasukkan karena belum ada pada 2020.',
  },
  setiabudi_timur: {
    shortName: 'Polder Setiabudi Timur',
    displayRadiusM: 650, // ~134 ha (R4) as an equal-area circle
    pumps: [
      { id: 'setiabudi_timur_p1', name: 'Pompa 1', capacityM3s: 1.74 },
      { id: 'setiabudi_timur_p2', name: 'Pompa 2', capacityM3s: 1.74 },
      { id: 'setiabudi_timur_p3', name: 'Pompa 3', capacityM3s: 1.74 },
      { id: 'setiabudi_timur_p4', name: 'Pompa 4', capacityM3s: 1.1 },
      { id: 'setiabudi_timur_p5', name: 'Pompa 5', capacityM3s: 1.1 },
      { id: 'setiabudi_timur_p6', name: 'Pompa 6', capacityM3s: 1.1 },
    ],
    pumpNote: 'Kapasitas 3 x 1,74 + 3 x 1,1 m3/s dari R4 (CNN Indonesia, Okt 2018); lebih tua dari 3 tahun, perlu konfirmasi DSDA.',
  },
  kelapa_gading: {
    shortName: 'Kelapa Gading',
    displayRadiusM: 900,
    pumps: [{ id: 'kelapa_gading_agg', name: 'Pompa Kelapa Gading (unit dan kapasitas 2020 belum diketahui)', capacityM3s: null }],
    pumpNote: 'Kali Betik 7 m3/s dan Artha Gading 7 m3/s adalah rencana 2022 (R5), belum ada pada 2020; pompa 2020 belum diketahui.',
  },
  bojong_indah: {
    shortName: 'Waduk Bojong Indah',
    displayRadiusM: 600,
    pumps: [
      { id: 'bojong_indah_p1', name: 'Pompa 1', capacityM3s: null },
      { id: 'bojong_indah_p2', name: 'Pompa 2', capacityM3s: null },
      { id: 'bojong_indah_p3', name: 'Pompa 3', capacityM3s: null },
      { id: 'bojong_indah_p4', name: 'Pompa 4', capacityM3s: null },
    ],
    pumpNote: 'Empat pompa disebut di R12 (2016); kapasitas tidak disebut.',
  },
};

// ---------------------------------------------------------------------------
// Rain (Open-Meteo historical archive, ERA5), fetched once and cached raw
// ---------------------------------------------------------------------------

export function rainUrl(points) {
  const lat = points.map((p) => p.lat).join(',');
  const lon = points.map((p) => p.lon).join(',');
  return (
    'https://archive-api.open-meteo.com/v1/archive' +
    `?latitude=${lat}&longitude=${lon}&start_date=${RAIN_START_DATE}&end_date=${RAIN_END_DATE}` +
    '&hourly=precipitation&timezone=UTC&models=era5'
  );
}

/**
 * Open-Meteo hourly precipitation at time T is the sum over the PRECEDING hour
 * (T-1h, T]. RainPoint.ts is the START of the hour, so ts = T - 1h.
 */
export function openMeteoToRainPoints(hourly) {
  const out = [];
  for (let i = 0; i < hourly.time.length; i += 1) {
    const endMs = Date.parse(`${hourly.time[i]}:00Z`);
    const mm = hourly.precipitation[i];
    out.push({ ts: new Date(endMs - 3600000).toISOString(), mm: mm === null ? 0 : Math.round(mm * 100) / 100, missing: mm === null });
  }
  return out;
}

async function loadRain(points, refresh) {
  if (!refresh && existsSync(RAW_RAIN_PATH)) {
    return JSON.parse(readFileSync(RAW_RAIN_PATH, 'utf8'));
  }
  const url = rainUrl(points);
  console.log(`fetching ${url}`);
  const res = await fetch(url, { headers: { 'User-Agent': 'noah-ai demo scenario builder (one-off)' } });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}: ${await res.text()}`);
  const body = await res.json();
  const raw = { fetchedAt: new Date().toISOString(), url, points, response: body };
  mkdirSync(RAW_DIR, { recursive: true });
  writeFileSync(RAW_RAIN_PATH, `${JSON.stringify(raw, null, 1)}\n`);
  return raw;
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function mode(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = values[0];
  let n = 0;
  for (const [v, c] of counts) if (c > n) [best, n] = [v, c];
  return best;
}

export async function build({ refresh = false } = {}) {
  const startUtc = wibToUtcIso(WINDOW_WIB.start);
  const endUtc = wibToUtcIso(WINDOW_WIB.end);
  const startMs = Date.parse(startUtc);
  const endMs = Date.parse(endUtc);

  const { stations: cfgStations, qc } = readStationsYaml(readFileSync(STATIONS_PATH, 'utf8'));
  const byAlias = new Map();
  for (const s of cfgStations) for (const a of s.aliases) byAlias.set(a.trim(), s);

  const { rows, bad } = parseTmaCsv(readFileSync(CSV_PATH, 'utf8'));
  if (bad.length) throw new Error(`${bad.length} unparseable CSV lines, first: ${bad[0]}`);

  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r.label)) groups.set(r.label, []);
    groups.get(r.label).push(r);
  }

  const stations = [];
  for (const [label, all] of [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const cfg = byAlias.get(label);
    if (!cfg) throw new Error(`S2 label without station config: ${label}`);
    const seen = new Set();
    const pts = [];
    let duplicates = 0;
    for (const r of all) {
      const ts = wibToUtcIso(r.wib);
      const ms = Date.parse(ts);
      if (ms < startMs || ms > endMs) continue;
      if (seen.has(ts)) {
        duplicates += 1;
        continue;
      }
      seen.add(ts);
      pts.push({ ts, cm: mmToCm(r.mm), siaga: mapSiaga(r.status) });
    }
    pts.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
    const q = qcSeries(pts, { spikeCm: qc.spike_cm ?? 100, maxGapMin: qc.spike_max_gap_minutes ?? 180, allowsNegative: cfg.allowsNegative === true });
    const notes = [];
    if (q.stuck) notes.push(`Nilai konstan ${q.stuckValueCm} cm sepanjang kejadian: sensor diduga macet; semua titik ditandai suspect.`);
    if (q.spikeTs.length) notes.push(`${q.spikeTs.length} lonjakan tunggal (>= ${qc.spike_cm ?? 100} cm dari kedua tetangga) ditandai suspect.`);
    if (q.negativeTs.length) notes.push(`${q.negativeTs.length} bacaan negatif ditandai suspect (datum belum terdokumentasi).`);
    if (duplicates) notes.push(`${duplicates} baris duplikat (waktu sama, hasil scrape berulang) digabung.`);
    const th = thresholds2020(cfg);
    stations.push({
      id: cfg.code,
      name: label,
      river: cfg.river ?? all[0].lokasi,
      lat: mode(all.map((r) => r.lat)),
      lon: mode(all.map((r) => r.lon)),
      thresholds: { siaga3: th.siaga3, siaga2: th.siaga2, siaga1: th.siaga1, source: th.source },
      qc: { stuck: q.stuck, spikeTs: q.spikeTs, negativeTs: q.negativeTs, duplicates, notes },
      series: q.points.map((p) => ({ ts: p.ts, cm: p.cm, siaga: p.siaga, quality: p.quality })),
    });
  }
  const stationByLabel = new Map(stations.map((s) => [s.name, s]));

  const candidates = readPolderCandidatesYaml(readFileSync(POLDERS_PATH, 'utf8')).filter((c) => c.refPoint && POLDER_DEMO[c.id]);
  const polders = candidates.map((c) => {
    const demo = POLDER_DEMO[c.id];
    const linked = c.nearestPosts.map((p) => ({ ...p, station: stationByLabel.get(p.post) })).filter((p) => p.station);
    const gaps = [];
    const stuck = linked.filter((p) => p.station.qc.stuck);
    if (linked.length && stuck.length === linked.length) {
      gaps.push(`Titik buta: semua pos TMA terkait (${stuck.map((p) => p.station.name).join(', ')}) bernilai konstan selama kejadian (sensor diduga macet), jadi perkiraan hanya memakai hujan.`);
    } else if (stuck.length) {
      gaps.push(`Pos ${stuck.map((p) => p.station.name).join(', ')} bernilai konstan (diduga macet) dan tidak dipakai.`);
    }
    const far = linked.filter((p) => p.km > 3);
    if (far.length) gaps.push(`Pos terdekat ${far.map((p) => `${p.station.name} ${String(p.km).replace('.', ',')} km`).join(', ')}; hubungan hidrolik belum dipastikan.`);
    return {
      id: c.id,
      name: demo.shortName,
      fullName: c.name,
      admin: c.admin,
      lat: c.refPoint.lat,
      lon: c.refPoint.lon,
      refPointLabel: c.refPoint.label,
      displayRadiusM: demo.displayRadiusM,
      stationIds: linked.map((p) => p.station.id),
      linkedPosts: linked.map((p) => ({ stationId: p.station.id, km: p.km, river: p.river })),
      pumps: demo.pumps,
      pumpNote: demo.pumpNote,
      evidence: { c3: c.evidence.c3 ?? null, c6: c.evidence.c6 ?? null, c7: c.evidence.c7 ?? null },
      note: ['Titik acuan perkiraan; batas polder menunggu data S8.', ...gaps, demo.pumpNote].join(' '),
      blindSpot: linked.length > 0 && stuck.length === linked.length,
    };
  });

  const rainRaw = await loadRain(polders.map((p) => ({ id: p.id, lat: p.lat, lon: p.lon })), refresh);
  const responses = Array.isArray(rainRaw.response) ? rainRaw.response : [rainRaw.response];
  if (responses.length !== polders.length) throw new Error(`rain: expected ${polders.length} locations, got ${responses.length}`);
  const rainFrom = startMs - 6 * 3600000;
  const rainTo = endMs + 6 * 3600000;
  const rain = {};
  polders.forEach((p, i) => {
    const r = responses[i];
    const series = openMeteoToRainPoints(r.hourly).filter((x) => Date.parse(x.ts) >= rainFrom && Date.parse(x.ts) < rainTo);
    rain[p.id] = {
      gridLat: r.latitude,
      gridLon: r.longitude,
      missingHours: series.filter((x) => x.missing).length,
      series: series.map((x) => ({ ts: x.ts, mm: x.mm })),
    };
  });

  const scenario = {
    id: 'banjir-2020-01-01',
    version: 1,
    window: { startWib: WINDOW_WIB.start, endWib: WINDOW_WIB.end, start: startUtc, end: endUtc },
    stepMin: STEP_MIN,
    sources: {
      levels: SOURCES.levels,
      rain: { ...SOURCES.rain, url: rainRaw.url, fetchedAt: rainRaw.fetchedAt, raw: 'lib/ops/demo/raw/open-meteo-era5-2019-12-30_2020-01-02.json' },
      thresholds: 'config/stations.yaml evidence.s2_2020 (ambang 2020; ambang berubah sejak itu)',
      polders: 'config/polder_candidates.yaml (titik acuan OSM Nominatim, bukan batas polder)',
    },
    stations,
    polders,
    rain,
  };
  mkdirSync(OUT_DIR, { recursive: true });
  const json = `${JSON.stringify(scenario)}\n`;
  writeFileSync(OUT_PATH, json);
  return { scenario, bytes: Buffer.byteLength(json) };
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  build({ refresh: process.argv.includes('--refresh') })
    .then(({ scenario, bytes }) => {
      console.log(`wrote ${OUT_PATH} (${(bytes / 1024).toFixed(1)} KB)`);
      for (const s of scenario.stations) {
        console.log(`  ${s.id.padEnd(20)} n=${String(s.series.length).padStart(3)} stuck=${s.qc.stuck} spikes=${s.qc.spikeTs.length} neg=${s.qc.negativeTs.length} th=${s.thresholds.siaga3}/${s.thresholds.siaga2}/${s.thresholds.siaga1} (${s.thresholds.source})`);
      }
      for (const p of scenario.polders) {
        const r = scenario.rain[p.id];
        const total = r.series.reduce((a, x) => a + x.mm, 0);
        const max = Math.max(...r.series.map((x) => x.mm));
        console.log(`  ${p.id.padEnd(16)} posts=${p.stationIds.join(',')} blind=${p.blindSpot} grid=${r.gridLat},${r.gridLon} rain total=${total.toFixed(1)} mm max=${max} mm/h`);
      }
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

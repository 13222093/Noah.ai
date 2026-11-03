// lib/ops/demo/provider.ts
//
// OpsProvider for the 1 January 2020 historical replay (the /operator section).
// Water levels and DSDA Siaga status are REAL archive data replayed; rain is
// REAL ERA5 reanalysis; nowcast, sump/pumps and recommendations are SIMULASI
// (engine.ts, demo-rule-v1). Everything is precomputed once; snapshotAt is
// memoized per 10-minute step so scrubbing stays cheap.
//
// No peeking: a snapshot or series "to" time never returns a value whose
// timestamp is after that time (rain: only hours that have ended).

import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { OpsProvider } from '../provider';
import type {
  Acknowledgement,
  ConnectorHealth,
  IsoUtc,
  LevelPoint,
  NowcastCell,
  OpsSnapshot,
  PolderStatus,
  PolderUnit,
  Provenance,
  RainPoint,
  Recommendation,
  ScenarioInfo,
  Station,
  StationReading,
} from '../types';
import { SCENARIO_DATA, type ScenarioData } from './data';
import { RULE_VERSION, runScenario, type ScenarioRun } from './engine';

export const ACK_STORAGE_KEY = 'noah-demo-acks-v1';
const MIN = 60_000;
const HOUR = 3_600_000;

/** Archive cadence is ~30 min; flag the connector stale at 1.5x that. */
export const S2_STALE_AFTER_MIN = 45;
/** ERA5 is hourly; stale when the last completed hour ended over 90 min ago. */
export const ERA5_STALE_AFTER_MIN = 90;

// ---------------------------------------------------------------------------
// Acknowledgements: browser only, persisted to localStorage (guarded)
// ---------------------------------------------------------------------------

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return typeof window === 'undefined' ? null : window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(name, value);
    } catch {
      /* storage unavailable (private mode, quota): keep in memory only */
    }
  },
  removeItem: (name) => {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

interface AckState {
  acks: Record<string, Acknowledgement>;
  acknowledge: (ack: Acknowledgement) => void;
  reset: () => void;
}

export const useDemoAckStore = create<AckState>()(
  persist(
    (set) => ({
      acks: {},
      acknowledge: (ack) => set((s) => ({ acks: { ...s.acks, [ack.recommendationId]: ack } })),
      reset: () => set({ acks: {} }),
    }),
    {
      name: ACK_STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => ({ acks: s.acks }),
    },
  ),
);

function useDemoAcknowledgements() {
  const acks = useDemoAckStore((s) => s.acks);
  const acknowledge = useDemoAckStore((s) => s.acknowledge);
  const reset = useDemoAckStore((s) => s.reset);
  return { acks, acknowledge, reset };
}

// ---------------------------------------------------------------------------
// Scenario info
// ---------------------------------------------------------------------------

export function buildScenarioInfo(data: ScenarioData, run: ScenarioRun): ScenarioInfo {
  return {
    id: data.id,
    title: 'Skenario historis: Banjir 1 Januari 2020',
    description:
      'Putar ulang malam tahun baru 2020: hujan ekstrem 31 Des sore hingga 1 Jan pagi, ' +
      'Ciliwung naik dari Katulampa dan Depok, Manggarai mencapai Siaga 1. ' +
      'TMA dan status Siaga adalah arsip asli DSDA (S2, mulai 31 Des 23:40 WIB untuk sebagian besar pos); ' +
      'peluang banjir, kolam/pompa, dan rekomendasi adalah SIMULASI.',
    start: data.window.start,
    end: data.window.end,
    stepMin: data.stepMin,
    initialTs: run.initialTs,
    moments: run.moments,
    disclosure: [
      'Tinggi muka air (TMA) dan status Siaga DSDA: data arsip ASLI (DSDA Posko Banjir, arsip S2 2020), diputar ulang, bukan data langsung. Zona waktu arsip diasumsikan WIB.',
      'Ambang Siaga yang dipakai adalah ambang 2020 (diturunkan dari label arsip); ambang DSDA sudah berubah sejak itu.',
      'Pos Pompa Yos Sudarso 1 dan PA. Pulo Gadung bernilai konstan selama kejadian (sensor diduga macet): ditandai suspect dan tidak dipakai, sehingga Pulomas, Sunter Selatan, dan Kelapa Gading menjadi titik buta TMA.',
      'Hujan: data reanalisis ASLI Open-Meteo ERA5, resolusi kasar (~28 km). ERA5 diketahui meremehkan hujan ekstrem lokal; BMKG mencatat 377 mm/hari di Halim Perdanakusuma pada kejadian ini (dilaporkan The Jakarta Post 1 Jan 2020 dan Mongabay Indonesia 3 Jan 2020).',
      '"Prakiraan hujan" di dalam aturan diambil dari data reanalisis jam-jam berikutnya (simulasi prakiraan sempurna); prakiraan sungguhan akan lebih buruk.',
      `Peluang banjir, isi kolam/pompa, dan rekomendasi adalah SIMULASI dari aturan demo (${RULE_VERSION}), bukan model yang tervalidasi, dan tidak dihitung dalam skor evaluasi apa pun.`,
      'Luas tangkapan, koefisien limpasan, volume kolam, dan kapasitas pompa yang tidak diketahui memakai nilai pengganti (placeholder) yang didokumentasikan; titik polder adalah titik acuan perkiraan, bukan batas polder.',
      'Gangguan Pompa 1 Setiabudi Timur (40% kapasitas mulai 1 Jan 00:00 WIB) disuntikkan untuk latihan; bukan kejadian nyata 2020.',
      'Rekomendasi hanya saran untuk operator; keputusan tetap di tangan operator. Pesan WhatsApp hanya pratinjau dan tidak dikirim.',
    ],
  };
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

function lastIndexAtOrBefore(ts: number[], t: number): number {
  let lo = 0;
  let hi = ts.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Small bounded memo so hooks get stable arrays for identical arguments. */
function memo<T>(limit = 256) {
  const m = new Map<string, T>();
  return (key: string, make: () => T): T => {
    const hit = m.get(key);
    if (hit !== undefined) return hit;
    const v = make();
    if (m.size >= limit) m.delete(m.keys().next().value as string);
    m.set(key, v);
    return v;
  };
}

export function createDemoProvider(data: ScenarioData = SCENARIO_DATA): OpsProvider {
  const run = runScenario(data);
  const scenario = buildScenarioInfo(data, run);
  const { startMs, stepMs, steps } = run;

  const stations: Station[] = data.stations.map((s) => ({
    id: s.id,
    name: s.name,
    river: s.river,
    lat: s.lat,
    lon: s.lon,
    thresholds: s.thresholds,
  }));
  const polders: PolderUnit[] = data.polders.map((p) => ({
    id: p.id,
    name: p.name,
    lat: p.lat,
    lon: p.lon,
    displayRadiusM: p.displayRadiusM,
    stationIds: p.stationIds,
    pumps: p.pumps,
    note: p.note,
  }));
  const polderIndex = new Map(data.polders.map((p, i) => [p.id, i]));
  const stationTs = data.stations.map((s) => s.series.map((p) => Date.parse(p.ts)));
  const stationById = new Map(data.stations.map((s, i) => [s.id, i]));
  const rainTs = new Map(data.polders.map((p) => [p.id, (data.rain[p.id]?.series ?? []).map((r) => Date.parse(r.ts))]));
  const recIssueMs = run.recommendations.map((r) => Date.parse(r.provenance.ts));
  const recEndMs = run.recommendations.map((r) => Date.parse(r.windowEnd));

  const levelProv = (ts: IsoUtc): Provenance => ({ kind: 'historical', source: data.sources.levels.source, ts });

  /** Step index whose time is <= at (round down), or -1 before the scenario. */
  const stepOf = (atMs: number) => (atMs < startMs ? -1 : Math.min(steps - 1, Math.floor((atMs - startMs) / stepMs)));

  function health(atMs: number): ConnectorHealth[] {
    let newest = -Infinity;
    data.stations.forEach((s, i) => {
      if (s.qc.stuck) return;
      const j = lastIndexAtOrBefore(stationTs[i], atMs);
      if (j >= 0 && stationTs[i][j] > newest) newest = stationTs[i][j];
    });
    let rainNewest = -Infinity; // end of the last completed hour
    for (const ts of rainTs.values()) {
      for (const s of ts) if (s + HOUR <= atMs && s + HOUR > rainNewest) rainNewest = s + HOUR;
    }
    const entry = (id: string, label: string, ms: number, staleAfter: number, prov: Provenance): ConnectorHealth => {
      const ok = Number.isFinite(ms);
      const age = ok ? Math.round((atMs - ms) / MIN) : null;
      return { id, label, newestTs: ok ? new Date(ms).toISOString() : null, ageMin: age, stale: age === null || age > staleAfter, provenance: prov };
    };
    const atIso = new Date(atMs).toISOString();
    return [
      entry('s2_tma_archive', 'Arsip TMA DSDA (S2, diputar ulang)', newest, S2_STALE_AFTER_MIN, levelProv(Number.isFinite(newest) ? new Date(newest).toISOString() : atIso)),
      entry('era5_rain', 'Hujan Open-Meteo ERA5 (reanalisis)', rainNewest, ERA5_STALE_AFTER_MIN, {
        kind: 'reanalysis',
        source: data.sources.rain.source,
        ts: Number.isFinite(rainNewest) ? new Date(rainNewest).toISOString() : atIso,
      }),
      entry('demo_engine', `Mesin simulasi (${RULE_VERSION})`, atMs, 15, { kind: 'simulated', source: 'Noah demo engine', ts: atIso, modelVersion: RULE_VERSION }),
    ];
  }

  function stationReadings(atMs: number): StationReading[] {
    return data.stations.map((s, i) => {
      const j = lastIndexAtOrBefore(stationTs[i], atMs);
      const latest = j >= 0 ? s.series[j] : null;
      return {
        station: stations[i],
        latest,
        ageMin: latest ? Math.round((atMs - stationTs[i][j]) / MIN) : null,
        provenance: latest ? levelProv(latest.ts) : null,
      };
    });
  }

  function openRecs(atMs: number): Recommendation[] {
    const out: Recommendation[] = [];
    for (let i = run.recommendations.length - 1; i >= 0; i -= 1) {
      if (recIssueMs[i] <= atMs && recEndMs[i] > atMs) out.push(run.recommendations[i]);
    }
    return out;
  }

  const snapshots: (OpsSnapshot | undefined)[] = new Array(steps);
  function buildSnapshot(k: number): OpsSnapshot {
    const atMs = startMs + k * stepMs;
    return {
      at: new Date(atMs).toISOString(),
      stations: stationReadings(atMs),
      polders: polders.map((unit, pi) => ({ unit, nowcast: run.nowcast[k][pi], status: run.status[k][pi] })),
      openRecommendations: openRecs(atMs),
      health: health(atMs),
    };
  }

  const seriesMemo = memo<LevelPoint[]>();
  const rainMemo = memo<RainPoint[]>();
  const nowcastMemo = memo<NowcastCell[]>();
  const statusMemo = memo<PolderStatus[]>();
  const recMemo = memo<Recommendation[]>(64);

  /** Inclusive step range whose issue time lies in [from, to]. */
  const stepRange = (fromMs: number, toMs: number): [number, number] => {
    const a = Math.max(0, Math.ceil((fromMs - startMs) / stepMs));
    const b = Math.min(steps - 1, Math.floor((toMs - startMs) / stepMs));
    return [a, b];
  };

  return {
    mode: 'demo',
    scenario,
    stations: () => stations,
    polders: () => polders,
    snapshotAt(at) {
      const atMs = Date.parse(at);
      const k = stepOf(atMs);
      if (k < 0) {
        return { at, stations: stationReadings(atMs), polders: [], openRecommendations: [], health: health(atMs) };
      }
      let s = snapshots[k];
      if (!s) {
        s = buildSnapshot(k);
        snapshots[k] = s;
      }
      return s;
    },
    levelSeries(stationId, from, to) {
      return seriesMemo(`${stationId}|${from}|${to}`, () => {
        const i = stationById.get(stationId);
        if (i === undefined) return [];
        const a = Date.parse(from);
        const b = Date.parse(to);
        return data.stations[i].series.filter((_, j) => stationTs[i][j] >= a && stationTs[i][j] <= b);
      });
    },
    rainSeries(polderId, from, to) {
      return rainMemo(`${polderId}|${from}|${to}`, () => {
        const series = data.rain[polderId]?.series ?? [];
        const ts = rainTs.get(polderId) ?? [];
        const a = Date.parse(from);
        const b = Date.parse(to);
        // Hours that overlap [from, to] and have ENDED by `to` (no peeking into the running hour).
        return series.filter((_, j) => ts[j] + HOUR > a && ts[j] + HOUR <= b);
      });
    },
    nowcastHistory(polderId, from, to) {
      return nowcastMemo(`${polderId}|${from}|${to}`, () => {
        const pi = polderIndex.get(polderId);
        if (pi === undefined) return [];
        const [a, b] = stepRange(Date.parse(from), Date.parse(to));
        const out: NowcastCell[] = [];
        for (let k = a; k <= b; k += 1) out.push(...run.nowcast[k][pi]);
        return out;
      });
    },
    statusHistory(polderId, from, to) {
      return statusMemo(`${polderId}|${from}|${to}`, () => {
        const pi = polderIndex.get(polderId);
        if (pi === undefined) return [];
        const [a, b] = stepRange(Date.parse(from), Date.parse(to));
        const out: PolderStatus[] = [];
        for (let k = a; k <= b; k += 1) out.push(run.status[k][pi]);
        return out;
      });
    },
    recommendationsUntil(at) {
      const atMs = Date.parse(at);
      const k = stepOf(atMs);
      return recMemo(String(k), () => {
        const out: Recommendation[] = [];
        for (let i = run.recommendations.length - 1; i >= 0; i -= 1) if (recIssueMs[i] <= atMs) out.push(run.recommendations[i]);
        return out;
      });
    },
    useAcknowledgements: useDemoAcknowledgements,
  };
}

// lib/time.ts
//
// Shared time helpers (B-029, TS half).
// Convention (CLAUDE.md, guardrail 8): store and exchange time in UTC,
// display in Asia/Jakarta (WIB, UTC+7, no daylight saving).
//
// Never use bare getHours()/getDate() or toLocale*String() without a
// timeZone for anything an operator sees. Use these helpers instead.

export const WIB_TIME_ZONE = 'Asia/Jakarta';
export const WIB_LABEL = 'WIB';

/** WIB is a fixed UTC+7 offset (Indonesia has no DST). */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export type TimeInput = string | number | Date;

// YYYY-MM-DD, optionally followed by [T or space]HH:mm[:ss[.fff]], optionally a zone.
const ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i;

interface IsoParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  ms: number;
  zone: string | undefined;
}

function matchIso(input: string): IsoParts | null {
  const m = ISO_RE.exec(input.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s, frac, zone] = m;
  return {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: h ? Number(h) : 0,
    minute: mi ? Number(mi) : 0,
    second: s ? Number(s) : 0,
    ms: frac ? Number(frac.slice(0, 3).padEnd(3, '0')) : 0,
    zone: zone || undefined,
  };
}

function zoneOffsetMs(zone: string): number {
  if (zone.toUpperCase() === 'Z') return 0;
  const sign = zone.startsWith('-') ? -1 : 1;
  const digits = zone.slice(1).replace(':', '');
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));
  return sign * (hours * 60 + minutes) * 60 * 1000;
}

function fromParts(p: IsoParts, defaultOffsetMs: number): Date {
  const offset = p.zone !== undefined ? zoneOffsetMs(p.zone) : defaultOffsetMs;
  const utcMs =
    Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second, p.ms) - offset;
  const date = new Date(utcMs);
  // Reject impossible calendar values (e.g. 2026-02-30) that Date.UTC would roll over.
  const check = new Date(utcMs + offset);
  if (
    check.getUTCFullYear() !== p.year ||
    check.getUTCMonth() !== p.month - 1 ||
    check.getUTCDate() !== p.day ||
    check.getUTCHours() !== p.hour ||
    check.getUTCMinutes() !== p.minute
  ) {
    throw new RangeError(`Invalid timestamp: ${JSON.stringify(p)}`);
  }
  return date;
}

function assertValid(date: Date, input: unknown): Date {
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid timestamp: ${String(input)}`);
  }
  return date;
}

/**
 * Parse a timestamp coming from the API or the database.
 * Strings without an explicit offset are treated as UTC (never as the
 * browser's local time). Numbers are epoch milliseconds.
 * Throws RangeError on anything that cannot be parsed.
 */
export function parseUtc(input: TimeInput): Date {
  if (input instanceof Date) return assertValid(new Date(input.getTime()), input);
  if (typeof input === 'number') return assertValid(new Date(input), input);
  const parts = matchIso(input);
  if (!parts) throw new RangeError(`Invalid timestamp: ${input}`);
  return fromParts(parts, 0);
}

/**
 * Parse a wall-clock time published by a Jakarta source (e.g. a DSDA page
 * that says "06:15") as Asia/Jakarta and return the UTC instant.
 * An explicit offset in the string wins over the WIB default.
 */
export function parseJakartaLocal(input: string): Date {
  const parts = matchIso(input);
  if (!parts) throw new RangeError(`Invalid timestamp: ${input}`);
  return fromParts(parts, WIB_OFFSET_MS);
}

/** ISO 8601 string in UTC, for storage and API payloads. */
export function toUtcIso(input: TimeInput): string {
  return parseUtc(input).toISOString();
}

export interface WibParts {
  year: number;
  month: number; // 1..12
  day: number;
  hour: number; // 0..23
  minute: number;
  second: number;
}

const wibFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: WIB_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** Calendar fields of an instant as seen in Asia/Jakarta (via Intl). */
export function getWibParts(input: TimeInput): WibParts {
  const date = parseUtc(input);
  const out: Record<string, number> = {};
  for (const part of wibFormatter.formatToParts(date)) {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
  }
  return {
    year: out.year,
    month: out.month,
    day: out.day,
    hour: out.hour === 24 ? 0 : out.hour,
    minute: out.minute,
    second: out.second,
  };
}

const ID_MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "13:05 WIB" (or "13:05:09 WIB" with seconds). */
export function formatWibTime(input: TimeInput, opts: { seconds?: boolean } = {}): string {
  const p = getWibParts(input);
  const time = opts.seconds
    ? `${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`
    : `${pad2(p.hour)}:${pad2(p.minute)}`;
  return `${time} ${WIB_LABEL}`;
}

/** "2 Nov 2026" in WIB. */
export function formatWibDate(input: TimeInput): string {
  const p = getWibParts(input);
  return `${p.day} ${ID_MONTHS_SHORT[p.month - 1]} ${p.year}`;
}

/** "2 Nov 2026 13:05 WIB". */
export function formatWibDateTime(input: TimeInput, opts: { seconds?: boolean } = {}): string {
  return `${formatWibDate(input)} ${formatWibTime(input, opts)}`;
}

/** Relative age in Bahasa Indonesia: "baru saja", "7 mnt lalu", "2 jam lalu", "3 hari lalu". */
export function formatAgeId(input: TimeInput, now: TimeInput = Date.now()): string {
  const diffMs = parseUtc(now).getTime() - parseUtc(input).getTime();
  if (diffMs < 0) return 'di masa depan';
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} mnt lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

/** Default staleness threshold, matching guardrail 12 (connector stale over 15 minutes). */
export const DEFAULT_STALE_AFTER_MINUTES = 15;

/** True when the observation is older than the threshold. */
export function isStale(
  input: TimeInput,
  now: TimeInput = Date.now(),
  staleAfterMinutes: number = DEFAULT_STALE_AFTER_MINUTES,
): boolean {
  return parseUtc(now).getTime() - parseUtc(input).getTime() > staleAfterMinutes * 60000;
}

/** "data terakhir 13:05 WIB (7 mnt lalu)". */
export function formatDataTerakhir(input: TimeInput, now: TimeInput = Date.now()): string {
  return `data terakhir ${formatWibTime(input)} (${formatAgeId(input, now)})`;
}

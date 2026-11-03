import { describe, it, expect } from 'vitest';
import {
  parseUtc,
  parseJakartaLocal,
  toUtcIso,
  getWibParts,
  formatWibTime,
  formatWibDate,
  formatWibDateTime,
  formatAgeId,
  isStale,
  formatDataTerakhir,
} from './time';

describe('parseUtc', () => {
  it.each([
    ['2026-11-02T06:05:00Z', '2026-11-02T06:05:00.000Z'],
    ['2026-11-02T06:05:00', '2026-11-02T06:05:00.000Z'], // no offset -> UTC, not browser local
    ['2026-11-02 06:05', '2026-11-02T06:05:00.000Z'],
    ['2026-11-02', '2026-11-02T00:00:00.000Z'],
    ['2026-11-02T13:05:00+07:00', '2026-11-02T06:05:00.000Z'],
    ['2026-11-02T13:05:00+0700', '2026-11-02T06:05:00.000Z'],
    ['2026-11-02T06:05:00.123456Z', '2026-11-02T06:05:00.123Z'],
    ['2026-11-01T23:30:00-05:00', '2026-11-02T04:30:00.000Z'],
  ])('%s -> %s', (input, expected) => {
    expect(parseUtc(input).toISOString()).toBe(expected);
  });

  it('accepts epoch ms and Date', () => {
    expect(parseUtc(0).toISOString()).toBe('1970-01-01T00:00:00.000Z');
    const d = new Date('2026-11-02T06:05:00Z');
    expect(parseUtc(d).getTime()).toBe(d.getTime());
    expect(parseUtc(d)).not.toBe(d);
  });

  it.each(['', 'kemarin', '2026-13-01T00:00:00Z', '2026-02-30T00:00:00Z', '02/11/2026'])(
    'rejects %j',
    (input) => {
      expect(() => parseUtc(input)).toThrow(RangeError);
    },
  );

  it('rejects an invalid Date', () => {
    expect(() => parseUtc(new Date('nope'))).toThrow(RangeError);
  });
});

describe('parseJakartaLocal (WIB wall clock -> UTC)', () => {
  it.each([
    ['2026-11-02 13:05', '2026-11-02T06:05:00.000Z'],
    ['2026-11-02T06:15:00', '2026-11-01T23:15:00.000Z'], // day boundary backwards
    ['2027-01-01 00:00', '2026-12-31T17:00:00.000Z'], // year boundary
    ['2026-11-02T13:05:00Z', '2026-11-02T13:05:00.000Z'], // explicit offset wins
  ])('%s -> %s', (input, expected) => {
    expect(parseJakartaLocal(input).toISOString()).toBe(expected);
  });
});

describe('UTC -> WIB display', () => {
  it.each([
    // [utc instant, time, date, date-time]
    ['2026-11-02T06:05:00Z', '13:05 WIB', '2 Nov 2026', '2 Nov 2026 13:05 WIB'],
    ['2026-11-01T17:30:00Z', '00:30 WIB', '2 Nov 2026', '2 Nov 2026 00:30 WIB'], // day boundary forwards
    ['2026-11-01T16:59:00Z', '23:59 WIB', '1 Nov 2026', '1 Nov 2026 23:59 WIB'],
    ['2026-12-31T17:00:00Z', '00:00 WIB', '1 Jan 2027', '1 Jan 2027 00:00 WIB'], // year boundary
    ['2026-05-15T00:00:00Z', '07:00 WIB', '15 Mei 2026', '15 Mei 2026 07:00 WIB'],
    ['2028-02-28T18:00:00Z', '01:00 WIB', '29 Feb 2028', '29 Feb 2028 01:00 WIB'], // leap day
  ])('%s', (utc, time, date, dateTime) => {
    expect(formatWibTime(utc)).toBe(time);
    expect(formatWibDate(utc)).toBe(date);
    expect(formatWibDateTime(utc)).toBe(dateTime);
  });

  it('formats seconds when asked', () => {
    expect(formatWibTime('2026-11-02T06:05:09Z', { seconds: true })).toBe('13:05:09 WIB');
  });

  it('round-trips WIB local -> UTC -> WIB parts', () => {
    const utc = parseJakartaLocal('2026-11-02 00:10');
    expect(toUtcIso(utc)).toBe('2026-11-01T17:10:00.000Z');
    expect(getWibParts(utc)).toEqual({ year: 2026, month: 11, day: 2, hour: 0, minute: 10, second: 0 });
  });
});

describe('age and staleness', () => {
  const now = '2026-11-02T06:15:00Z';
  it.each([
    ['2026-11-02T06:14:30Z', 'baru saja'],
    ['2026-11-02T06:08:00Z', '7 mnt lalu'],
    ['2026-11-02T04:10:00Z', '2 jam lalu'],
    ['2026-10-30T06:15:00Z', '3 hari lalu'],
    ['2026-11-02T06:20:00Z', 'di masa depan'],
  ])('%s -> %s', (ts, expected) => {
    expect(formatAgeId(ts, now)).toBe(expected);
  });

  it.each([
    ['2026-11-02T06:00:00Z', false], // exactly 15 min: not yet stale
    ['2026-11-02T05:59:59Z', true],
    ['2026-11-02T06:10:00Z', false],
  ])('isStale(%s) = %s', (ts, expected) => {
    expect(isStale(ts, now)).toBe(expected);
  });

  it('builds the "data terakhir" line', () => {
    expect(formatDataTerakhir('2026-11-02T06:08:00Z', now)).toBe('data terakhir 13:08 WIB (7 mnt lalu)');
  });
});

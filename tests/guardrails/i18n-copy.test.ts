// @vitest-environment node
/**
 * F9 / B-023 (qa-W1): UI dictionaries must not carry capability claims or
 * public-warning copy (guardrails 1 and 5), and id/en must stay in step.
 */
import { describe, expect, it } from 'vitest';
import id from '@/src/i18n/id';
import en from '@/src/i18n/en';

function leaves(obj: unknown, prefix = ''): Array<[string, string]> {
  if (typeof obj === 'string') return [[prefix, obj]];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    leaves(v, prefix ? `${prefix}.${k}` : k),
  );
}

const BANNED = [
  /lstm/i,
  /real[\s-]?time/i,
  /\blive\b/i,
  /\bsms\b/i,
  /evaku|evacu/i,
  /34\s*prov/i,
  /peringatan dini|early warning/i,
  /akurasi|accuracy/i,
  /cctv/i,
  /chatbot/i,
];

describe('i18n dictionaries', () => {
  it('id and en have the same keys', () => {
    expect(leaves(en).map(([k]) => k)).toEqual(leaves(id).map(([k]) => k));
  });

  it.each([
    ['id', id],
    ['en', en],
  ])('%s has no banned copy', (_lang, dict) => {
    for (const [key, value] of leaves(dict)) {
      for (const re of BANNED) expect(value, `${key}: ${value}`).not.toMatch(re);
    }
  });
});

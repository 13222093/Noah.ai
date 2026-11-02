// @vitest-environment node
/**
 * Routes removed in W1 must stay removed (B-024; B-007 guardrail 1, B-014 SSRF / open LLM proxies).
 * A Next.js App Router route exists iff app/<path>/route.* or app/<path>/page.* exists.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '..', '..');

function routeFiles(dir: string): string[] {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter((f) => /^(route|page)\.(t|j)sx?$/.test(f));
}

const DELETED = [
  // B-007: citizen SMS pipeline and smart-alert chain
  'app/api/sms-alert',
  'app/api/sms-subscribe',
  'app/api/smart-alert',
  'app/sms-subscribe',
  // B-014: SSRF routes and open LLM proxies
  'app/api/cctv-scan',
  'app/api/analysis',
  'app/api/ai-alerts',
  'app/api/flood-analysis',
  'app/api/news-summary',
  // F11 (qa-W1): legacy PetaBencana proxy (connector now in ml-service S15)
  // and user_preferences reader (table has no migration; dropped in B-032)
  'app/api/disaster-proxy',
  'app/api/preferences',
];

describe('deleted routes stay deleted', () => {
  it.each(DELETED)('%s has no route or page', (dir) => {
    expect(routeFiles(dir)).toEqual([]);
  });
});

describe('chatbot is parked (B-014)', () => {
  const file = ['route.ts', 'route.js']
    .map((f) => join(ROOT, 'app/api/chatbot', f))
    .find((f) => existsSync(f));

  it('is either deleted or answers 410 Gone', async () => {
    if (!file) return; // deleted entirely (404), which also satisfies B-014
    const mod = (await import(file)) as Record<string, unknown>;
    const handlers = ['GET', 'POST'].filter((m) => typeof mod[m] === 'function');
    expect(handlers.length).toBeGreaterThan(0);
    for (const m of handlers) {
      const init: RequestInit = { method: m };
      if (m === 'POST') {
        init.body = JSON.stringify({ message: 'x' });
        init.headers = { 'content-type': 'application/json' };
      }
      const res = await (mod[m] as (r: Request) => Promise<Response>)(new Request('http://localhost/api/chatbot', init));
      expect(res.status).toBe(410);
    }
  });
});

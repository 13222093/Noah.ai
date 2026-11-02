// @vitest-environment node
/**
 * B-010 / F6 (qa-W1): the interim access gate in middleware.ts.
 *
 * Covers: fail-closed when NOAH_GATE_* is unset or the password is short,
 * correct and wrong credentials, the allowlist, malformed Authorization
 * headers, path-traversal variants, and that every refusal is byte-identical
 * whether or not the route exists (the gate must not leak the route table).
 *
 * Test credentials only; generated here, never real.
 */
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAllowlisted, isAuthorized, middleware } from '@/middleware';

const USER = 'operator-test';
const PASS = 'test-password-0123456789'; // 24 chars, >= 16
const ORIGIN = 'http://localhost:3000';

function basic(user: string, pass: string): string {
  const bytes = new TextEncoder().encode(`${user}:${pass}`);
  return `Basic ${btoa(String.fromCharCode(...bytes))}`;
}

function req(path: string, authorization?: string): NextRequest {
  const headers = new Headers();
  if (authorization !== undefined) headers.set('authorization', authorization);
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

/** NextResponse.next() marks the response with x-middleware-next. */
function passed(res: Response): boolean {
  return res.headers.get('x-middleware-next') === '1';
}

async function snapshot(res: Response) {
  const body = new Uint8Array(await res.arrayBuffer());
  return {
    status: res.status,
    headers: [...res.headers.entries()].sort(([a], [b]) => a.localeCompare(b)),
    body: Array.from(body),
  };
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  errorSpy.mockRestore();
});

function configure(user: string | undefined, pass: string | undefined) {
  vi.stubEnv('NOAH_GATE_USER', user as string);
  vi.stubEnv('NOAH_GATE_PASSWORD', pass as string);
}

describe('fail closed when the gate is misconfigured', () => {
  it.each([
    ['both unset', undefined, undefined],
    ['user unset', undefined, PASS],
    ['password unset', USER, undefined],
    ['both empty', '', ''],
    ['user empty', '', PASS],
    ['password 15 chars', USER, 'x'.repeat(15)],
  ])('%s: denies even a request that sends those exact values', async (_label, user, pass) => {
    configure(user, pass);
    const res = await middleware(req('/', basic(user ?? '', pass ?? '')));
    expect(res.status).toBe(401);
    expect(passed(res)).toBe(false);
  });

  it('accepts a password of exactly 16 chars', async () => {
    const pass16 = 'p'.repeat(16);
    configure(USER, pass16);
    const res = await middleware(req('/', basic(USER, pass16)));
    expect(passed(res)).toBe(true);
  });

  it('logs the misconfiguration without leaking the values', async () => {
    configure(USER, 'short-secret');
    await middleware(req('/dashboard'));
    for (const call of errorSpy.mock.calls) {
      const line = call.map(String).join(' ');
      expect(line).not.toContain('short-secret');
      expect(line).not.toContain(USER);
    }
  });

  it('isAuthorized fails closed on empty or short env', async () => {
    expect(await isAuthorized(basic('', ''), {})).toBe(false);
    expect(await isAuthorized(basic(USER, 'short'), { user: USER, pass: 'short' })).toBe(false);
    expect(await isAuthorized(basic('', PASS), { user: '', pass: PASS })).toBe(false);
  });
});

describe('credential check', () => {
  beforeEach(() => configure(USER, PASS));

  it('passes correct credentials on a page and an API route', async () => {
    for (const path of ['/', '/dashboard', '/settings', '/api/v1/anything']) {
      const res = await middleware(req(path, basic(USER, PASS)));
      expect(passed(res), path).toBe(true);
    }
  });

  it('accepts a case-insensitive "basic" scheme', async () => {
    const header = basic(USER, PASS).replace('Basic', 'basic');
    expect(passed(await middleware(req('/', header)))).toBe(true);
  });

  it('accepts a password that itself contains a colon', async () => {
    const pass = 'with:colon:0123456789';
    configure(USER, pass);
    expect(passed(await middleware(req('/', basic(USER, pass))))).toBe(true);
  });

  it('decodes UTF-8 credentials', async () => {
    const user = 'operátor';
    configure(user, PASS);
    expect(passed(await middleware(req('/', basic(user, PASS))))).toBe(true);
  });

  it.each([
    ['wrong user', basic('someone-else', PASS)],
    ['wrong password', basic(USER, `${PASS}x`)],
    ['password prefix', basic(USER, PASS.slice(0, -1))],
    ['user case differs', basic(USER.toUpperCase(), PASS)],
    ['swapped', basic(PASS, USER)],
    ['empty password', basic(USER, '')],
  ])('%s -> 401', async (_label, header) => {
    const res = await middleware(req('/dashboard', header));
    expect(res.status).toBe(401);
    expect(passed(res)).toBe(false);
  });
});

describe('malformed Authorization headers -> 401', () => {
  beforeEach(() => configure(USER, PASS));

  const good = basic(USER, PASS).slice('Basic '.length);
  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['scheme only', 'Basic'],
    ['scheme and space', 'Basic '],
    ['Bearer scheme', `Bearer ${good}`],
    ['no scheme', good],
    ['invalid base64 chars', 'Basic !!!not-base64!!!'],
    ['bad base64 padding', 'Basic abc'],
    ['no colon in decoded value', `Basic ${btoa('nocolonhere')}`],
    ['two tokens', `Basic ${good} ${good}`],
    ['raw credentials, not encoded', `Basic ${USER}:${PASS}`],
  ])('%s', async (_label, header) => {
    const res = await middleware(req('/dashboard', header));
    expect(res.status).toBe(401);
    expect(passed(res)).toBe(false);
  });
});

describe('allowlist passes without credentials', () => {
  it.each(['/api/v1/health', '/_next/static/chunks/main.js', '/_next/static/css/app.css', '/favicon.ico', '/robots.txt', '/sw.js'])(
    '%s (gate configured)',
    async (path) => {
      configure(USER, PASS);
      expect(passed(await middleware(req(path)))).toBe(true);
    },
  );

  it.each(['/api/v1/health', '/_next/static/chunks/main.js', '/robots.txt', '/sw.js'])(
    '%s (gate misconfigured: still reachable)',
    async (path) => {
      configure(undefined, undefined);
      expect(passed(await middleware(req(path)))).toBe(true);
    },
  );

  it.each([
    '/',
    '/api/v1/health/',
    '/api/v1/health/extra',
    '/api/v1/healthz',
    '/api/v1',
    '/_next/static',
    '/_next/image?url=x',
    '/_next/data/build/index.json',
    '/favicon.ico.bak',
    '/sw.js.map',
    '/robots.txt/x',
  ])('%s is not allowlisted', async (path) => {
    configure(USER, PASS);
    const res = await middleware(req(path));
    expect(res.status).toBe(401);
  });

  it.each([
    '/_next/static/../api/secret',
    '/_next/static/%2e%2e/api/secret',
    '/_next/static/%2E%2E/api/secret',
    '/_next/static/x%2fy',
    '/_next/static/x%5cy',
    '/_next/static/x\\y',
    '/_next/static//api/secret',
  ])('traversal variant %s is never allowlisted', (path) => {
    expect(isAllowlisted(path)).toBe(false);
  });

  it('encoded traversal through the middleware falls through to auth', async () => {
    configure(USER, PASS);
    const res = await middleware(req('/_next/static/%2e%2e/dashboard'));
    expect(res.status).toBe(401);
  });
});

describe('uniform 401', () => {
  beforeEach(() => configure(USER, PASS));

  it('existing and non-existent routes return byte-identical refusals', async () => {
    const paths = ['/', '/dashboard', '/settings', '/api/v1/missing', '/does-not-exist', '/api/sms-alert', '/.env'];
    const snaps = await Promise.all(paths.map(async (p) => snapshot(await middleware(req(p)))));
    for (const s of snaps.slice(1)) expect(s).toEqual(snaps[0]);
  });

  it('wrong credentials and no credentials return the same refusal', async () => {
    const a = await snapshot(await middleware(req('/dashboard')));
    const b = await snapshot(await middleware(req('/does-not-exist', basic(USER, 'wrong-password-0123456'))));
    const c = await snapshot(await middleware(req('/dashboard', 'Bearer x')));
    expect(b).toEqual(a);
    expect(c).toEqual(a);
  });

  it('a misconfigured gate refuses with the same response', async () => {
    const configured = await snapshot(await middleware(req('/dashboard')));
    configure(undefined, undefined);
    const misconfigured = await snapshot(await middleware(req('/dashboard', basic(USER, PASS))));
    expect(misconfigured).toEqual(configured);
  });

  it('carries the expected headers and body', async () => {
    const res = await middleware(req('/dashboard'));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBe('Basic realm="Noah AI", charset="UTF-8"');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(await res.text()).toBe('Unauthorized');
  });
});

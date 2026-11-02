// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { Event } from '@sentry/nextjs';
import { missingRequiredEnv, scrubEvent, scrubString } from '../../instrumentation';

describe('Sentry scrubbing (B-028, guardrails 3 and 12)', () => {
  it('redacts phones, e-mails, JWTs, bearer tokens and secret query params in strings', () => {
    // Built from parts so no JWT-shaped literal sits in the repo (gitleaks).
    const jwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJyb2xlIjoidGVzdCJ9AAAA', 'c2lnbmF0dXJlLXRlc3QtdmFsdWU'].join('.');
    const s = scrubString(
      `call 0812-3456-7890 or +62 812 3456 7890, mail op@example.go.id, ${jwt}, Bearer abcdefgh12345678, /x?appid=abc123&ok=1`,
    );
    expect(s).not.toMatch(/3456/);
    expect(s).not.toContain('op@example.go.id');
    expect(s).not.toContain(jwt);
    expect(s).toContain('Bearer [TOKEN]');
    expect(s).toContain('appid=[Filtered]&ok=1');
  });

  it('keeps operational numbers (water levels, timestamps) intact', () => {
    const msg = 'TMA Manggarai 750 cm at 2026-11-02T10:00:00Z, run 1730541600000';
    expect(scrubString(msg)).toBe(msg);
  });

  it('drops cookies, auth headers, user identity and sensitive keys', () => {
    const event: Event = {
      user: { id: 'u-1', email: 'a@b.co', ip_address: '1.2.3.4', username: 'budi' },
      request: {
        url: 'https://noah.example/api/v1/x?token=secret-value',
        cookies: { sb: 'session' },
        headers: { Authorization: 'Bearer xyzxyzxyzxyz', 'user-agent': 'ua' },
        data: { phone_number: '081234567890', note: 'hubungi 081234567890', polder: 'Pluit' },
      },
      extra: { SUPABASE_SERVICE_ROLE_KEY: 'should-not-leak', nested: { reporter_contact: 'x' } },
    };
    const out = scrubEvent(event);
    expect(out.user).toEqual({ id: 'u-1' });
    expect(out.request?.cookies).toBeUndefined();
    expect(out.request?.headers).toEqual({ 'user-agent': 'ua' });
    expect(out.request?.url).toBe('https://noah.example/api/v1/x?token=[Filtered]');
    expect(out.request?.data).toEqual({ phone_number: '[Filtered]', note: 'hubungi [PHONE]', polder: 'Pluit' });
    expect(JSON.stringify(out.extra)).not.toContain('should-not-leak');
    expect(JSON.stringify(out.extra)).not.toContain('"x"');
  });
});

describe('startup env check (B-005)', () => {
  it('reports missing required variables by name', () => {
    expect(missingRequiredEnv({})).toEqual([
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]);
  });
  it('accepts a complete env and rejects an invalid NOAH_DEMO_MODE', () => {
    const ok = { NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 's' };
    expect(missingRequiredEnv(ok)).toEqual([]);
    expect(missingRequiredEnv({ ...ok, NOAH_DEMO_MODE: 'yes' })).toHaveLength(1);
  });
});

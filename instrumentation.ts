/**
 * Next.js instrumentation hook: env validation at server start and Sentry for
 * the Node.js and Edge runtimes (B-005, B-028, guardrails 10 and 12).
 *
 * `scrubEvent` is also used by instrumentation-client.ts so browser, server and
 * edge events get the same PII and secret scrubbing.
 */
import type { Event, EventHint } from '@sentry/nextjs';

// ---------------------------------------------------------------------------
// PII / secret scrubbing
// ---------------------------------------------------------------------------

const FILTERED = '[Filtered]';

/** Object keys whose values are always dropped. */
const SENSITIVE_KEY =
  /pass(word)?|passwd|secret|token|api[-_]?key|apikey|appid|authorization|auth|cookie|session|jwt|service[-_]?role|bearer|signature|sig$|phone|msisdn|telp|no[-_]?hp|whatsapp|wa[-_]?number|e-?mail|nik$|ktp|alamat|address|reporter|contact|kontak/i;

/** Value patterns replaced inside any string. Order matters. */
const VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[JWT]'],
  [/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{10,}/g, '[KEY]'],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, 'Bearer [TOKEN]'],
  [
    /([?&;](?:access_token|refresh_token|token|api[-_]?key|apikey|appid|key|secret|password|sig|signature|code)=)[^&#\s"']*/gi,
    '$1[Filtered]',
  ],
  [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[EMAIL]'],
  // Indonesian mobile numbers (+62 / 62 / 0 followed by 8xx) and E.164 numbers.
  [/(?<![\d])(?:\+?62|0)[\s-]?8[1-9](?:[\s-]?\d){6,10}(?![\d])/g, '[PHONE]'],
  [/\+\d(?:[\s-]?\d){7,14}(?![\d])/g, '[PHONE]'],
];

export function scrubString(value: string): string {
  let out = value;
  for (const [re, replacement] of VALUE_PATTERNS) out = out.replace(re, replacement);
  return out;
}

function scrubValue(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (value === null || typeof value !== 'object') return value;
  if (depth > 12 || seen.has(value)) return value;
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) value[i] = scrubValue(value[i], depth + 1, seen);
    return value;
  }
  const obj = value as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    obj[key] = SENSITIVE_KEY.test(key) ? FILTERED : scrubValue(obj[key], depth + 1, seen);
  }
  return obj;
}

/**
 * Sentry `beforeSend` / `beforeSendTransaction`: removes cookies, auth headers,
 * user identity other than an opaque id, and redacts phones, e-mails, JWTs,
 * bearer tokens and secret query parameters anywhere in the event.
 */
export function scrubEvent<T extends Event>(event: T, _hint?: EventHint): T {
  if (event.user) {
    event.user = event.user.id !== undefined ? { id: event.user.id } : {};
  }
  if (event.request) {
    delete event.request.cookies;
    if (event.request.headers) {
      for (const h of Object.keys(event.request.headers)) {
        if (/^(authorization|cookie|set-cookie|x-api-key|apikey|x-forwarded-for|x-real-ip)$/i.test(h)) {
          delete event.request.headers[h];
        }
      }
    }
  }
  return scrubValue(event, 0, new WeakSet()) as T;
}

export function scrubBreadcrumb<B extends { message?: string; data?: Record<string, unknown> }>(crumb: B): B {
  return scrubValue(crumb, 0, new WeakSet()) as B;
}

// ---------------------------------------------------------------------------
// Startup env check (fail closed in production)
// ---------------------------------------------------------------------------

/** Server variables without which production must not start. */
export const REQUIRED_SERVER_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

export function missingRequiredEnv(env: Record<string, string | undefined> = process.env): string[] {
  const missing: string[] = REQUIRED_SERVER_ENV.filter((k) => !env[k] || env[k]!.trim() === '');
  const demo = env.NOAH_DEMO_MODE;
  if (demo !== undefined && demo !== '' && demo !== 'true' && demo !== 'false') {
    missing.push('NOAH_DEMO_MODE (must be "true" or "false")');
  }
  return missing;
}

function sampleRate(name: string, fallback: number): number {
  const n = Number(process.env[name] ?? fallback);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
}

export async function register() {
  const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
  if (process.env.NODE_ENV === 'production' && !isBuild) {
    const missing = missingRequiredEnv();
    if (missing.length > 0) {
      // Names only, never values.
      throw new Error(`Noah refuses to start: missing or invalid env: ${missing.join(', ')}`);
    }
  }

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn,
    enabled: true,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NOAH_STACK || process.env.NODE_ENV,
    tracesSampleRate: sampleRate('SENTRY_TRACES_SAMPLE_RATE', 0.1),
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    initialScope: { tags: { runtime: process.env.NEXT_RUNTIME ?? 'unknown', service: 'noah-web' } },
  });
}

/** Reports errors from Server Components, route handlers and middleware. */
export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (Sentry.captureRequestError as (...a: any[]) => void)(...args);
}

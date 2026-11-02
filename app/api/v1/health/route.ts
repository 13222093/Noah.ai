import { NextResponse } from 'next/server';

// `/api/v1/health` (B-040; allowlisted by middleware.ts, B-010).
// Proxies the FastAPI per-connector freshness report so an uptime monitor can
// watch one public URL. The upstream body is already safe to expose (no
// error texts, no env flags, no secrets); it is passed through with its
// status (200 healthy, 503 degraded). This route adds nothing of its own.
//
// Upstream: NOAH_API_URL (server-only), falling back to ML_API_URL from
// .env.example. Unset: 501 not_configured. Unreachable or malformed: 503.
export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 5000;
const HEADERS = { 'Cache-Control': 'no-store' };

function upstreamBase(): string | null {
  const raw = (process.env.NOAH_API_URL || process.env.ML_API_URL || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin + url.pathname.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

export async function GET() {
  const base = upstreamBase();
  if (!base) {
    return NextResponse.json({ status: 'not_configured' }, { status: 501, headers: HEADERS });
  }
  try {
    const res = await fetch(`${base}/api/v1/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    });
    const body: unknown = await res.json();
    const status = res.status === 200 ? 200 : 503;
    return NextResponse.json(body, { status, headers: HEADERS });
  } catch {
    // Never echo the upstream address or the error.
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: HEADERS });
  }
}

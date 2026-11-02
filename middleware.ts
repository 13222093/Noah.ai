import { NextResponse, type NextRequest } from 'next/server';

/**
 * B-010: interim deny-by-default access gate (until OIDC lands in B-063, W3).
 *
 * Every page and API route requires HTTP Basic credentials that match
 * NOAH_GATE_USER / NOAH_GATE_PASSWORD from the environment. Nothing is
 * hardcoded. If either variable is unset, empty, or the password is shorter
 * than MIN_PASSWORD_LENGTH, the gate fails closed and refuses everything
 * except the allowlist below.
 *
 * Allowlist (no credential needed):
 *   - /api/v1/health (exact path)
 *   - build assets under /_next/static/
 *   - /favicon.ico, /robots.txt and /sw.js (kill-switch worker; old PWA clients must reach it)
 *
 * Every refusal is the same 401 with the same body for every path, whether
 * or not a route exists, so the gate does not leak the route table.
 *
 * Runs on the Edge runtime: Web APIs only (atob, TextEncoder, crypto.subtle).
 */

const MIN_PASSWORD_LENGTH = 16;
const REALM = 'Noah AI';

const EXACT_ALLOW = new Set<string>(['/api/v1/health', '/favicon.ico', '/robots.txt', '/sw.js']);
const PREFIX_ALLOW = ['/_next/static/'];

let warnedMisconfigured = false;

export function isAllowlisted(pathname: string): boolean {
  // Reject anything that could be re-interpreted further down the stack.
  const lower = pathname.toLowerCase();
  if (
    lower.includes('..') ||
    lower.includes('%2e') ||
    lower.includes('%2f') ||
    lower.includes('%5c') ||
    lower.includes('\\') ||
    lower.includes('//')
  ) {
    return false;
  }
  if (EXACT_ALLOW.has(pathname)) return true;
  return PREFIX_ALLOW.some((p) => pathname.startsWith(p));
}

async function sha256(input: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return new Uint8Array(digest);
}

/** Constant-time comparison of two strings via their SHA-256 digests. */
async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < da.length; i++) diff |= da[i] ^ db[i];
  return diff === 0;
}

function decodeBasic(header: string | null): { user: string; pass: string } | null {
  if (!header) return null;
  const match = /^Basic\s+([A-Za-z0-9+/=]+)\s*$/i.exec(header);
  if (!match) return null;
  try {
    const bin = atob(match[1]);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(bytes);
    const idx = decoded.indexOf(':');
    if (idx < 0) return null;
    return { user: decoded.slice(0, idx), pass: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

export async function isAuthorized(
  authorization: string | null,
  env: { user?: string; pass?: string },
): Promise<boolean> {
  const expectedUser = env.user ?? '';
  const expectedPass = env.pass ?? '';
  if (!expectedUser || expectedPass.length < MIN_PASSWORD_LENGTH) return false; // fail closed
  const given = decodeBasic(authorization);
  if (!given) return false;
  const [userOk, passOk] = await Promise.all([
    safeEqual(given.user, expectedUser),
    safeEqual(given.pass, expectedPass),
  ]);
  return userOk && passOk;
}

function deny(): NextResponse {
  return new NextResponse('Unauthorized', {
    status: 401,
    headers: {
      'WWW-Authenticate': `Basic realm="${REALM}", charset="UTF-8"`,
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isAllowlisted(pathname)) return NextResponse.next();

  const user = process.env.NOAH_GATE_USER;
  const pass = process.env.NOAH_GATE_PASSWORD;
  if ((!user || !pass || pass.length < MIN_PASSWORD_LENGTH) && !warnedMisconfigured) {
    warnedMisconfigured = true;
    // Never log values, only that the gate is closed.
    console.error(
      `[access-gate] NOAH_GATE_USER/NOAH_GATE_PASSWORD missing or password shorter than ${MIN_PASSWORD_LENGTH} chars; denying all non-allowlisted requests.`,
    );
  }

  if (await isAuthorized(request.headers.get('authorization'), { user, pass })) {
    return NextResponse.next();
  }
  return deny();
}

// Run on every path; the allowlist above is the only exception.
export const config = {
  matcher: '/:path*',
};

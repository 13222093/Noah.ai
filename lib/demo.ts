// lib/demo.ts
//
// Demo / simulation flag (B-015, guardrail 5).
// Synthetic or demo data may only be shown when this returns true, and it
// must then be visibly labelled with <SimulasiBadge /> / <SimulasiBanner />.
// Default is false: an unset or unrecognised value never enables demo mode.
//
// In the browser only NEXT_PUBLIC_NOAH_DEMO_MODE is available (Next inlines it
// at build time). On the server NOAH_DEMO_MODE is also honoured.

const TRUTHY = new Set(['true', '1', 'yes', 'on']);

export function parseDemoFlag(value: string | undefined | null): boolean {
  if (!value) return false;
  return TRUTHY.has(value.trim().toLowerCase());
}

export function isDemoMode(): boolean {
  // Keep the literal `process.env.NEXT_PUBLIC_...` access so Next can inline it.
  return (
    parseDemoFlag(process.env.NEXT_PUBLIC_NOAH_DEMO_MODE) ||
    parseDemoFlag(process.env.NOAH_DEMO_MODE)
  );
}

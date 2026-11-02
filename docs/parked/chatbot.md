# Parked: Gemini chatbot (`/api/chatbot`)

Status: **PARKED** in W1 by B-014 (G-018, audit BE-024). Not part of the December scope.

## What was done
- `app/api/chatbot/route.ts` was removed from the build. The path now returns Next.js's normal 404, and anonymous requests get the B-010 gate's 401 before routing.
- The last source is kept verbatim, uncompiled, at `docs/parked/chatbot/route.ts.txt` (taken from commit `49a23e3` on `w1-foundation`). It contains no secrets; it read `GEMINI_API_KEY` and `OPEN_WEATHER_API_KEY` from the environment.
- The UI callers are for operator-ui-engineer to remove or hide: `components/tiling/RightTile.tsx`, `components/layout/CommandCenterView.tsx`, `components/layout/DashboardClientPage.tsx`, and `app/statistics/page.tsx`/`GeminiChatSection.tsx` if they still exist.

Backlog note: B-014 asks for a 410 response with a test. We parked the route by taking it out of the build, so the path now returns 404, as the W1 coordinator instructed. The B-024 test should assert 404 for an authenticated request, or 401 for an anonymous one.

## Why it was parked
- 2 of its 8 tools fed it non-live or broken data. `fetchWaterLevelData` returned the 2020 replay stamped `now()` (deleted in B-016). `fetchPumpStatusData` called a missing route.
- Its answers had no provenance (guardrail 7). It had no auth and was aimed at the public (guardrail 1). The `displayNotification` tool let the model push arbitrary popups. The client `history` it accepted was not validated, which allowed prompt injection.
- It used Gemini, while the budget names the Anthropic API at about USD 20 per month (guardrail 14).
- SCCIC's CITYA already covers the operator-assistant role (`01_PRODUCT_BRIEF.md`).

## Conditions for bringing it back
1. Only authenticated operators may use it (B-063 OIDC and roles), and every question and answer is written to `audit_log`.
2. Its tools are only v1 read endpoints (`/api/v1/observations`, `/nowcast/current`, `/polders/{id}/status`, `/scoreboard`). It gets no external fetch tools and no popup tool.
3. Every answer cites station, model version and timestamp, and it says "Belum ada data" when data is missing.
4. It uses the budgeted Anthropic API, with a server-side rate limit per user.
5. Bahasa Indonesia comes first, and the wording makes clear that the operator decides (guardrails 15 and 16).
6. Check first that it does not duplicate CITYA (ask SCCIC).

Open question for Ari: if the Gemini key is still active, revoke it now that the chatbot is parked (audit question 9).

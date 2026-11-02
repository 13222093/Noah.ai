# Runbook: purge leaked secrets from git history (B-006, G-005)

**Status: not run. Needs Ari's explicit approval in chat, after every secret below has been rotated.** Rewriting history does not undo the exposure: `origin` (`github.com/13222093/Noah.ai`) is public and the secrets have been readable since they were committed. Rotation is the fix. The rewrite only stops further spread.

## Preconditions (all required)

1. Rotated or revoked, with the old value confirmed rejected:
   - Supabase service_role JWT (G-001, B-001). Rolling the JWT secret also changes the anon key; update Vercel, local and VPS envs.
   - Roboflow API key (G-002, B-002).
   - OpenWeatherMap key in history and the current browser-exposed key (G-003, G-004, B-003).
2. Secret scanning is in place: `.gitleaks.toml`, `.pre-commit-config.yaml`, the `secrets` CI job (B-004).
3. Ari has approved, in chat: (a) the rewrite, (b) the force-push to `origin`, (c) what to do with the `fork` remote (`github.com/13222093/noah.git`, returns 404 today).
4. All open branches are merged or listed. Every collaborator is told to stop pushing.

## What to purge

| Kind | Target | Why |
| --- | --- | --- |
| Path | `supabase/.temp/` | Supabase CLI cache: project ref, pooler host (G-007). |
| Path | `test-supabase.js` | Service-role test script (G-134). |
| Path | `ml-service/models/*.pt` | AGPL YOLO weights (G-076). Optional, shrinks the repo. |
| Text | Supabase service_role JWT | Literal at `scripts/seed-regions.mjs:9`, from `9c886eb` onward. |
| Text | Roboflow key | Fallback at `ml-service/src/yolo_model.py:48`, from `5f0fa0e` onward. |
| Text | OpenWeatherMap key | Fallback at `app/api/chatbot/route.ts:38` in `5f0fa0e`, removed in `0ea2529`. |

Never write the secret values into this repository, a ticket or a chat. Build the replace file locally, outside the repo, from the values you hold, and delete it afterwards.

## Steps

Run on a trusted machine with `git-filter-repo` (MIT) installed (`pip install git-filter-repo`).

```sh
# 1. Fresh mirror clone (filter-repo refuses to run on a non-fresh clone).
git clone --mirror https://github.com/13222093/Noah.ai.git noah-rewrite.git
cd noah-rewrite.git

# 2. Backup that never leaves the machine; delete it once verification passes.
git bundle create ../noah-pre-rewrite.bundle --all

# 3. Replacement file OUTSIDE the repo, one line per secret:
#      <literal secret>==>REDACTED_SUPABASE_SERVICE_ROLE
#      <literal secret>==>REDACTED_ROBOFLOW_KEY
#      <literal secret>==>REDACTED_OWM_KEY
#    Use `regex:` lines instead if you want to match by pattern.
$EDITOR ../replacements.txt

# 4. Rewrite.
git filter-repo \
  --replace-text ../replacements.txt \
  --invert-paths \
  --path supabase/.temp/ \
  --path test-supabase.js \
  --path-glob 'ml-service/models/*.pt'

# 5. Remove the replace file.
shred -u ../replacements.txt 2>/dev/null || rm -f ../replacements.txt
```

## Verify before pushing

```sh
# a) gitleaks over the full rewritten history: must report no leaks.
gitleaks git . --config <path-to-checkout>/.gitleaks.toml --redact --verbose

# b) Purged paths are gone from every ref.
git log --all --oneline -- supabase/.temp test-supabase.js | wc -l    # expect 0

# c) No JWT-shaped literal anywhere (count only, never print).
git log --all -p | grep -cE 'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{20,}\.'    # expect 0

# d) The tree at HEAD still builds and tests pass (clone the rewritten mirror, npm ci, vitest, pytest).
```

## Push (only after approval)

```sh
git push --force --mirror origin
```

Then:

1. GitHub caches old commits (PR views, forks, `refs/pull/*`, which a mirror push cannot rewrite). Open a GitHub Support request to purge cached views and dangling commits of the repository, and list the affected SHAs (`9c886eb`, `5f0fa0e` and their descendants that carried the secrets).
2. Every collaborator deletes their local clone and re-clones. Rebasing old branches brings the secrets back.
3. Decide the `fork` remote: delete it, or rewrite it the same way.
4. Re-run the CI `secrets` job on `main` and record the green run.
5. Record the approval, the date, the operator and the verification output (without values) in `docs/audit/`.
6. Delete `../noah-pre-rewrite.bundle` once everything checks out.

## Done when

A gitleaks full-history scan on a fresh clone is clean, and Ari's approval is recorded.

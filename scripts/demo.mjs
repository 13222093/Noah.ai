#!/usr/bin/env node
/**
 * Build and start the app with the 1 January 2020 operator replay as a
 * production build (docs/demo/script.md). Production avoids the dev-only
 * Leaflet StrictMode error and the dev "Issue" badge, and is faster on stage.
 * The operator screens are at /operator; the original app is unchanged.
 *
 *   npm run demo                # build, then start on port 3000
 *   npm run demo -- --port 3200 # another port
 *   npm run demo -- --no-build  # start the last demo build again
 *
 * Demo mode (NOAH_DEMO_MODE, NEXT_PUBLIC_NOAH_DEMO_MODE) is forced on here
 * only; it is inlined at build time, so never deploy a build made by this
 * script. NEXT_PUBLIC_CARTO_BASEMAP_KEY (CARTO dark basemap) comes from the
 * environment, else from .env.development.local (gitignored); without it the
 * operator map uses Esri Dark Gray. There is no access gate on this branch.
 * Needs internet for the build (Google Fonts) and on stage (map tiles).
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const portIx = args.indexOf('--port');
const port = portIx >= 0 ? args[portIx + 1] : '3000';
const build = !args.includes('--no-build');

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

const local = readEnvFile('.env.development.local');
const env = {
  ...process.env,
  NOAH_DEMO_MODE: 'true',
  NEXT_PUBLIC_NOAH_DEMO_MODE: 'true',
  // Inlined at build time; without it the map falls back to Esri Dark Gray.
  NEXT_PUBLIC_CARTO_BASEMAP_KEY:
    process.env.NEXT_PUBLIC_CARTO_BASEMAP_KEY || local.NEXT_PUBLIC_CARTO_BASEMAP_KEY || '',
};

function run(cmdArgs) {
  const res = spawnSync('npx', ['next', ...cmdArgs], { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (res.status !== 0) process.exit(res.status ?? 1);
}

if (build) run(['build']);
console.log(
  `\ndemo: http://localhost:${port}/operator  (operator replay; the original app is at http://localhost:${port}/)` +
    `\n      basemap: ${env.NEXT_PUBLIC_CARTO_BASEMAP_KEY ? 'CARTO Dark Matter' : 'Esri Dark Gray (no NEXT_PUBLIC_CARTO_BASEMAP_KEY)'}\n`,
);
run(['start', '-p', port]);

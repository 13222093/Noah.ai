#!/usr/bin/env node
/**
 * Guardrail checks that can be automated (docs/plan/10_GUARDRAILS.md, B-015).
 * Dependency-free so it runs in CI and pre-commit before `npm ci`.
 *
 *   node scripts/check-guardrails.mjs          # scan tracked + untracked (non-ignored) files
 *   node scripts/check-guardrails.mjs a.ts b.py   # scan only the given files
 *
 * Rules
 *   no-math-random   Math.random outside tests and demo folders            (guardrail 5)
 *   no-py-random     np.random / numpy.random / stdlib random outside tests and demo (guardrail 5)
 *   no-sms-gateway   twilio and other SMS/WhatsApp SDKs; messages.create in such files (guardrail 1)
 *   no-scada-write   Modbus / OPC-UA / SCADA client libraries               (guardrail 2)
 *   no-ultralytics   AGPL Ultralytics in the core                           (guardrail 13)
 *   no-unbudgeted    Upstash, Gemini SDKs, Roboflow                         (guardrail 14)
 *   no-public-owm    NEXT_PUBLIC_OPENWEATHER* (key shipped to browsers)     (guardrail 10)
 *
 * Exit code 1 when any finding is reported.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CODE_EXT = /\.(?:[cm]?[jt]sx?)$/i;
const PY_EXT = /\.py$/i;
const MANIFEST = /(?:^|\/)(?:package\.json|requirements[^/]*\.txt|pyproject\.toml)$/i;

/** Paths never scanned: docs, agent config, vendored or generated output, this tool. */
const IGNORED = [
  /^node_modules\//,
  /\/node_modules\//,
  /^\.next\//,
  /^\.git\//,
  /^docs\//,
  /^documentation\//,
  /^\.claude\//,
  /\.md$/i,
  /^package-lock\.json$/,
  /^public\/sw\.js$/,
  /^public\/workbox-[^/]+\.js$/,
  /^public\/fallback-[^/]+\.js$/,
  /\.map$/,
  /^scripts\/check-guardrails\.mjs$/,
  /^supabase\/migrations\//, // legacy schema; dropped in B-032
];

/** Test and demo locations where synthetic randomness is allowed. */
export function isTestOrDemo(path) {
  return (
    /(^|\/)tests?\//.test(path) ||
    /(^|\/)demo\//.test(path) ||
    /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) ||
    /(^|\/)test_[^/]*\.py$/.test(path) ||
    /(^|\/)[^/]*_test\.py$/.test(path) ||
    /(^|\/)conftest\.py$/.test(path)
  );
}

const SMS_CONTEXT = /twilio|vonage|nexmo|messagebird|\bsms\b|whatsapp/i;

/** Line-level rules. `files` selects which paths a rule applies to. */
const RULES = [
  {
    id: 'no-math-random',
    files: (p) => CODE_EXT.test(p) && !isTestOrDemo(p),
    re: /\bMath\s*\.\s*random\b/,
    msg: 'Math.random is banned outside tests/ and demo/ (guardrail 5). Use crypto.randomUUID / crypto.getRandomValues, or real data.',
  },
  {
    id: 'no-py-random',
    files: (p) => PY_EXT.test(p) && !isTestOrDemo(p),
    re: /\b(?:np|numpy)\s*\.\s*random\b|^\s*(?:import\s+random\b|from\s+random\s+import\b|from\s+numpy\s+import\s+random\b|from\s+numpy\.random\s+import\b)/,
    msg: 'np.random / random is banned outside tests/ and demo/ (guardrail 5).',
  },
  {
    id: 'no-sms-gateway',
    files: (p) => (CODE_EXT.test(p) || PY_EXT.test(p)) && !isTestOrDemo(p),
    re: /(?:from|require\(|import\()\s*['"](?:twilio|vonage|@vonage\/[\w-]+|nexmo|messagebird)['"]|^\s*(?:from|import)\s+twilio\b/,
    msg: 'SMS/WhatsApp gateway SDKs are banned: Noah never messages residents (guardrail 1).',
  },
  {
    id: 'no-sms-gateway',
    files: (p) => (CODE_EXT.test(p) || PY_EXT.test(p)) && !isTestOrDemo(p),
    re: /\bmessages\s*\.\s*create\s*\(/,
    // Only in files that talk about SMS gateways; the Anthropic SDK also has messages.create.
    fileGuard: (content) => SMS_CONTEXT.test(content),
    msg: 'messages.create in an SMS/WhatsApp context is banned (guardrail 1).',
  },
  {
    id: 'no-scada-write',
    files: (p) => (CODE_EXT.test(p) || PY_EXT.test(p)) && !isTestOrDemo(p),
    re: /['"](?:modbus-serial|jsmodbus|node-modbus|modbus-stream|node-opcua[\w-]*|opcua|node-snap7|plc4x|@?st-one-io\/nodes7)['"]|^\s*(?:from|import)\s+(?:pymodbus|pyModbusTCP|minimalmodbus|umodbus|asyncua|opcua|snap7|pycomm3|pylogix)\b/,
    msg: 'SCADA / Modbus / OPC-UA client libraries are banned: Noah never writes to pumps or gates (guardrail 2).',
  },
  {
    id: 'no-ultralytics',
    files: (p) => PY_EXT.test(p),
    re: /^\s*(?:from|import)\s+ultralytics\b/,
    msg: 'Ultralytics is AGPL and may not be linked into the core (guardrail 13).',
  },
  {
    id: 'no-unbudgeted',
    files: (p) => (CODE_EXT.test(p) || PY_EXT.test(p)) && !isTestOrDemo(p),
    re: /['"](?:@upstash\/[\w-]+|@google\/generative-ai|@google\/genai)['"]|^\s*(?:from|import)\s+(?:google\.generativeai|google\.genai|roboflow|inference_sdk)\b|serverless\.roboflow\.com/,
    msg: 'Unbudgeted external service (Upstash, Gemini, Roboflow). Ask Ari before adding paid services (guardrail 14).',
  },
  {
    id: 'no-public-owm',
    files: (p) => !MANIFEST.test(p) && !isTestOrDemo(p),
    re: /NEXT_PUBLIC_OPENWEATHER/,
    msg: 'OpenWeatherMap keys must never be NEXT_PUBLIC_ (shipped to browsers) (guardrail 10).',
  },
];

/** Denied packages in manifests (package.json, requirements*.txt, pyproject.toml). */
const DENIED_PACKAGES = {
  'no-sms-gateway': ['twilio', 'vonage', '@vonage/server-sdk', 'nexmo', 'messagebird'],
  'no-scada-write': [
    'modbus-serial', 'jsmodbus', 'node-modbus', 'node-opcua', 'node-snap7',
    'pymodbus', 'pymodbustcp', 'minimalmodbus', 'umodbus', 'asyncua', 'opcua', 'python-snap7', 'pycomm3', 'pylogix',
  ],
  'no-ultralytics': ['ultralytics'],
  'no-unbudgeted': ['@upstash/redis', '@upstash/ratelimit', '@google/generative-ai', '@google/genai', 'google-generativeai', 'google-genai', 'roboflow', 'inference-sdk'],
};

function scanManifest(path, content) {
  const findings = [];
  const denied = new Map();
  for (const [rule, pkgs] of Object.entries(DENIED_PACKAGES)) for (const p of pkgs) denied.set(p.toLowerCase(), rule);

  if (/package\.json$/i.test(path)) {
    let json;
    try {
      json = JSON.parse(content);
    } catch {
      return findings;
    }
    for (const section of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const name of Object.keys(json[section] ?? {})) {
        const rule = denied.get(name.toLowerCase());
        if (rule) findings.push({ path, line: 1, rule, text: `${section}: ${name}`, msg: `Denied package "${name}".` });
      }
    }
    return findings;
  }

  content.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) return;
    const m = line.match(/^["']?([A-Za-z0-9_.\-@/]+)/);
    if (!m) return;
    const name = m[1].toLowerCase().replace(/_/g, '-');
    const rule = denied.get(name);
    if (rule) findings.push({ path, line: i + 1, rule, text: raw.trim(), msg: `Denied package "${m[1]}".` });
  });
  return findings;
}

/** Scan one file's content. Exported for tests. */
export function scanContent(path, content) {
  const p = path.replace(/\\/g, '/');
  if (IGNORED.some((re) => re.test(p))) return [];
  const findings = MANIFEST.test(p) ? scanManifest(p, content) : [];
  const lines = content.split(/\r?\n/);
  for (const rule of RULES) {
    if (!rule.files(p)) continue;
    if (rule.fileGuard && !rule.fileGuard(content)) continue;
    lines.forEach((text, i) => {
      if (rule.re.test(text)) findings.push({ path: p, line: i + 1, rule: rule.id, text: text.trim().slice(0, 160), msg: rule.msg });
    });
  }
  return findings;
}

function listFiles() {
  const out = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return [...new Set(out.split('\0').filter(Boolean))];
}

export function run(files) {
  const findings = [];
  for (const f of files) {
    if (!existsSync(f)) continue; // deleted in the working tree
    const st = statSync(f);
    if (!st.isFile() || st.size > 2 * 1024 * 1024) continue;
    const p = f.replace(/\\/g, '/');
    if (!(CODE_EXT.test(p) || PY_EXT.test(p) || MANIFEST.test(p))) continue;
    findings.push(...scanContent(p, readFileSync(f, 'utf8')));
  }
  return findings;
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const findings = run(args.length ? args : listFiles());
  if (findings.length === 0) {
    console.log('guardrails: OK (no findings)');
  } else {
    for (const f of findings) {
      // GitHub Actions annotation format, readable locally too.
      console.log(`::error file=${f.path},line=${f.line},title=${f.rule}::${f.msg} | ${f.text}`);
    }
    console.error(`\nguardrails: ${findings.length} finding(s). See docs/plan/10_GUARDRAILS.md.`);
    process.exit(1);
  }
}

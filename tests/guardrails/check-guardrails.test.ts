// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { scanContent, isTestOrDemo } from '../../scripts/check-guardrails.mjs';

type Finding = { rule: string; path: string; line: number };
const rules = (path: string, content: string) => (scanContent(path, content) as Finding[]).map((f) => f.rule);

describe('check-guardrails: Math.random (guardrail 5)', () => {
  it('flags production code', () => {
    expect(rules('app/api/x/route.ts', 'const v = Math.random();')).toEqual(['no-math-random']);
    expect(rules('lib/foo.tsx', 'const v = Math . random()')).toEqual(['no-math-random']);
  });
  it('allows tests and demo folders', () => {
    expect(rules('tests/unit/a.test.ts', 'Math.random()')).toEqual([]);
    expect(rules('lib/a.test.ts', 'Math.random()')).toEqual([]);
    expect(rules('lib/a.spec.tsx', 'Math.random()')).toEqual([]);
    expect(rules('components/demo/Sim.tsx', 'Math.random()')).toEqual([]);
    expect(isTestOrDemo('app/dashboard/page.tsx')).toBe(false);
  });
  it('ignores docs', () => {
    expect(rules('docs/plan/x.md', 'Math.random()')).toEqual([]);
  });
});

describe('check-guardrails: Python randomness', () => {
  it('flags np.random and stdlib random outside tests', () => {
    expect(rules('ml-service/src/noah/m.py', 'x = np.random.rand(3)')).toEqual(['no-py-random']);
    expect(rules('ml-service/src/noah/m.py', 'import random')).toEqual(['no-py-random']);
    expect(rules('ml-service/tests/test_m.py', 'x = np.random.rand(3)')).toEqual([]);
  });
});

describe('check-guardrails: deny-list', () => {
  it('flags SMS gateways (guardrail 1)', () => {
    expect(rules('app/api/a/route.ts', "import twilio from 'twilio';")).toContain('no-sms-gateway');
    expect(rules('app/api/a/route.ts', "const t = await import('twilio');\nclient.messages.create({})")).toEqual([
      'no-sms-gateway',
      'no-sms-gateway',
    ]);
  });
  it('does not flag the Anthropic SDK messages.create', () => {
    expect(rules('lib/llm.ts', "import Anthropic from '@anthropic-ai/sdk';\nawait client.messages.create({})")).toEqual([]);
  });
  it('flags SCADA write libraries (guardrail 2) and ultralytics (guardrail 13)', () => {
    expect(rules('ml-service/src/noah/p.py', 'from pymodbus.client import ModbusTcpClient')).toEqual(['no-scada-write']);
    expect(rules('lib/plc.ts', "import { OPCUAClient } from 'node-opcua';")).toEqual(['no-scada-write']);
    expect(rules('ml-service/src/noah/cv.py', 'from ultralytics import YOLO')).toEqual(['no-ultralytics']);
  });
  it('flags denied packages in manifests', () => {
    expect(rules('package.json', JSON.stringify({ dependencies: { twilio: '^5.0.0', zod: '^3' } }))).toEqual([
      'no-sms-gateway',
    ]);
    expect(rules('ml-service/requirements.txt', 'fastapi==0.115\nultralytics>=8\n')).toEqual(['no-ultralytics']);
    expect(rules('ml-service/requirements.txt', 'pymodbus==3.6\n')).toEqual(['no-scada-write']);
  });
  it('flags unbudgeted services and browser-exposed OWM keys', () => {
    expect(rules('src/lib/redis.ts', "import { Redis } from '@upstash/redis';")).toEqual(['no-unbudgeted']);
    expect(rules('lib/geo.ts', 'const k = process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;')).toEqual(['no-public-owm']);
  });
});

// Field-Ready C1: one explicit whole-product AI-Off acceptance harness.
//
// Every child drives built Bloomlab through real Chromium input and IndexedDB. `cdp.mjs` holds
// the product setting at Off and makes Worker AI routes unavailable for the entire browser
// profile. This runner records path-level outcomes and fails if a deterministic-only path tries
// an AI route. Mixed/open-ended paths may attempt evaluation only when their existing probe is
// specifically exercising the truthful saved/pending fallback.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = resolve(process.env.REVIEW_OUT ?? '.review/field-ready-ai-off');
mkdirSync(OUT, { recursive: true });

const paths = [
  {
    id: 'command-center-session',
    script: 'remediation-home-probe.mjs',
    covers: ['Command Center', 'session start'],
    ai: 'none',
  },
  {
    id: 'learning-sync-diagnostics',
    script: 'learning-probe.mjs',
    covers: [
      'Developer learning diagnostics (supporting evidence)',
      'mastery update',
      'saved progress',
    ],
    ai: 'none',
  },
  {
    id: 'academy',
    script: 'academy-probe.mjs',
    covers: ['Academy reading and embeds', 'unit completion', 'offline completion and reload'],
    ai: 'none',
  },
  {
    id: 'skill-map-campaign',
    script: 'advanced-paths-probe.mjs',
    covers: [
      'Skill Map and detail',
      'Campaign',
      'deterministic exercise',
      'mastery update',
      'offline progress',
    ],
    ai: 'none',
  },
  {
    id: 'advanced-labs',
    script: 'advanced-labs-probe.mjs',
    covers: ['Payments', 'advanced CRM and Calendar', 'deterministic save and simulation'],
    ai: 'none',
  },
  {
    id: 'incident',
    script: 'incident-probe.mjs',
    covers: ['Incident Lab', 'deterministic diagnosis and completion'],
    ai: 'none',
  },
  {
    id: 'open-ended-ai-off',
    script: 'ai-off-control-probe.mjs',
    covers: ['Open-ended saved/pending fallback', 'reload', 'continued deterministic Lab access'],
    ai: 'none',
  },
  {
    id: 'crm',
    script: 'crm-probe.mjs',
    covers: ['CRM Lab', 'save', 'reload', 'offline'],
    ai: 'none',
  },
  {
    id: 'workflow-conversations',
    script: 'workflow-probe.mjs',
    covers: ['Workflow Lab', 'Conversations/Inbox', 'simulate', 'save', 'reload'],
    ai: 'none',
  },
  {
    id: 'funnel',
    script: 'funnel-probe.mjs',
    covers: ['Funnel Lab', 'simulate', 'save', 'reload'],
    ai: 'none',
  },
  {
    id: 'calendar',
    script: 'calendar-probe.mjs',
    covers: ['Calendar', 'simulate', 'save', 'reload'],
    ai: 'none',
  },
  {
    id: 'reporting',
    script: 'reporting-probe.mjs',
    covers: ['Reporting', 'calculated simulator report'],
    ai: 'none',
  },
  {
    id: 'pricing',
    script: 'pricing-probe.mjs',
    covers: ['Pricing', 'deterministic grading', 'mastery write'],
    ai: 'none',
  },
  {
    id: 'negotiation',
    script: 'negotiation-probe.mjs',
    covers: ['Negotiation authored behavior', 'AI-Off clarification fallback'],
    ai: 'fallback-only',
  },
  {
    id: 'portfolio',
    script: 'portfolio-probe.mjs',
    covers: ['Portfolio', 'saved evidence', 'offline reload'],
    ai: 'none',
  },
  {
    id: 'offline-recovery',
    script: 'offline-probe.mjs',
    covers: ['PWA reload', 'local save', 'recovery'],
    ai: 'none',
  },
];

const boundary = /^AI_OFF_BOUNDARY (.+)$/gm;
const report = {
  checkpoint: 'C1',
  requirement: 'PRD-004',
  head: process.env.REVIEW_HEAD ?? 'working-tree',
  base: BASE,
  product_ai_setting: 'Off',
  worker_ai_routes: 'unavailable',
  paths: [],
};

async function run(entry, extraEnv = {}) {
  const started = Date.now();
  const child = spawn(process.execPath, [resolve('scripts/review', entry.script)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BASE,
      REVIEW_AI_OFF: '1',
      REVIEW_OUT: resolve(OUT, entry.id),
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding('utf8');
    stream.on('data', (chunk) => {
      output += chunk;
      process.stdout.write(chunk);
    });
  }
  const code = await new Promise((done) => child.on('close', done));
  const boundaries = [...output.matchAll(boundary)].map((match) => JSON.parse(match[1]));
  const modesHeldOff = boundaries.length > 0 && boundaries.every((item) => item.mode === 'Off');
  const attempts = boundaries.flatMap((item) => item.attempted_ai_routes ?? []);
  const unexpectedAi = entry.ai === 'none' && attempts.length > 0;
  const outcome = code === 0 && modesHeldOff && !unexpectedAi ? 'PASSED' : 'FAILED';
  const row = {
    id: entry.id,
    covers: entry.covers,
    probe: entry.script,
    outcome,
    exit_code: code,
    ai_mode_verified: modesHeldOff,
    ai_route_attempts: attempts,
    ai_policy: entry.ai,
    duration_ms: Date.now() - started,
  };
  console.log(`AI_OFF_PATH ${JSON.stringify(row)}`);
  return row;
}

for (const entry of paths) report.paths.push(await run(entry));

const negative = await run(
  {
    id: 'negative-control',
    script: 'ai-off-control-probe.mjs',
    covers: ['Deliberately introduced AI dependency on CRM'],
    ai: 'none',
  },
  { REVIEW_AI_OFF_NEGATIVE: '1' },
);
const detected =
  negative.exit_code === 0 &&
  negative.ai_mode_verified &&
  negative.outcome === 'FAILED' &&
  negative.ai_route_attempts.some(
    (attempt) => attempt.url === '/api/ai/field-ready-negative-control',
  );

report.negative_control = {
  rule: 'A deterministic-only path fails if it attempts /api/ai/*.',
  exercised: detected,
  detected,
  result: negative,
  deterministic_attempts: report.paths
    .filter((entry) => entry.ai_policy === 'none')
    .flatMap((entry) => entry.ai_route_attempts),
};
report.verdict =
  detected && report.paths.every((entry) => entry.outcome === 'PASSED') ? 'PASSED' : 'FAILED';
writeFileSync(resolve(OUT, 'ai-off-suite.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.verdict !== 'PASSED') process.exitCode = 1;

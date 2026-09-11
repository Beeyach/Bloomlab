#!/usr/bin/env node
// Joins the router/content-derived inventory to exact-head browser evidence. It distinguishes a
// route-specific browser state, a shared route contract and a genuine N/A; it never turns a
// source-only or human-only judgment into a browser PASS.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

import { REQUIRED_WIDTHS, SCREEN_INVENTORY } from './screen-matrix.mjs';

const evidenceRoot = resolve(process.env.EVIDENCE_ROOT ?? '.review/field-ready-browser');
const out = resolve(process.env.REVIEW_OUT ?? '.review/field-ready-screen-states');
mkdirSync(out, { recursive: true });
const suitePath = resolve(evidenceRoot, 'suite.json');
assert(existsSync(suitePath), `Missing exact-head browser suite: ${suitePath}`);
const suite = JSON.parse(readFileSync(suitePath, 'utf8'));
assert.equal(
  suite.head,
  process.env.REVIEW_HEAD,
  'Screen evidence must match the requested exact head',
);
const probeRows = new Map(suite.probes.map((probe) => [probe.name, probe]));
const evidence = (...probes) => {
  for (const probe of probes)
    assert.equal(probeRows.get(probe)?.status, 'PASSED', `Required ${probe} evidence did not pass`);
  return {
    status: 'RELATED_BROWSER_EVIDENCE',
    limitation:
      'The referenced probe passed, but this family-level mapping does not establish this exact screen/state/input cell. State-specific assertion mapping remains required.',
    probes,
    artifacts: probes.map((probe) =>
      relative(process.cwd(), resolve(evidenceRoot, probe, 'run.log')).replaceAll('\\', '/'),
    ),
  };
};
const sharedLoading = () => ({
  status: 'PROVEN_SHARED_ROUTE_CONTRACT',
  probes: ['lazy-route'],
  sources: [
    'apps/web/src/app/routes.tsx',
    'apps/web/src/app/App.tsx',
    'apps/web/src/app/RouteLoading.tsx',
  ],
  limitation:
    'All learner routes are lazy and share Suspense loading; held data loading is cited separately where it exists.',
});
const sharedError = () => ({
  status: 'PROVEN_SHARED_ROUTE_CONTRACT',
  sources: [
    'apps/web/src/app/App.tsx',
    'apps/web/src/app/ScreenErrorBoundary.tsx',
    'apps/web/src/app/ScreenErrorBoundary.test.tsx',
  ],
  limitation:
    'Every learner route is wrapped by the tested boundary; this is not represented as independent fault injection for every static screen.',
});
const notApplicable = (reason) => ({ status: 'N/A', reason });

for (const probe of ['polish', 'a11y', 'lazy-route', 'navigation', 'sidebar-resize'])
  assert.equal(probeRows.get(probe)?.status, 'PASSED', `Required ${probe} evidence did not pass`);

const FAMILY = {
  home: {
    empty: () => evidence('remediation-home'),
    loading: () => evidence('remediation-home'),
    error: () => evidence('remediation-home'),
    completed: () => evidence('remediation-keyboard'),
    keyboard: () => evidence('remediation-keyboard'),
    touch: () => evidence('remediation-home'),
  },
  campaign: {
    empty: () => evidence('advanced-paths'),
    loading: () => evidence('advanced-paths'),
    error: () => evidence('advanced-paths'),
    completed: () => evidence('advanced-paths'),
    keyboard: () => evidence('advanced-paths'),
    touch: () => evidence('advanced-paths'),
  },
  skills: {
    empty: () => evidence('moments'),
    loading: sharedLoading,
    error: sharedError,
    completed: () => evidence('moments'),
    keyboard: () => evidence('advanced-paths'),
    touch: () => evidence('advanced-paths', 'moments'),
  },
  academy: {
    empty: () =>
      notApplicable(
        'A valid Git-owned Academy unit always has authored content; an unknown unit is the explicit not-found state.',
      ),
    loading: () => evidence('academy'),
    error: () => evidence('academy'),
    completed: () => evidence('academy'),
    keyboard: () => evidence('academy', 'remediation-keyboard'),
    touch: () => evidence('academy'),
  },
  'exercise-runner': {
    empty: () => evidence('exercise'),
    loading: sharedLoading,
    error: () => evidence('exercise', 'remediation-exercise'),
    completed: () => evidence('exercise', 'remediation-exercise'),
    keyboard: () => evidence('remediation-keyboard'),
    touch: () => evidence('exercise', 'remediation-exercise'),
  },
  pricing: {
    empty: () => evidence('pricing'),
    loading: sharedLoading,
    error: () => evidence('pricing'),
    completed: () => evidence('pricing', 'remediation-exercise'),
    keyboard: () => evidence('pricing'),
    touch: () => evidence('pricing', 'remediation-exercise'),
  },
  negotiation: {
    empty: () => evidence('negotiation'),
    loading: sharedLoading,
    error: () => evidence('negotiation'),
    completed: () => evidence('negotiation'),
    keyboard: () => evidence('negotiation'),
    touch: () => evidence('negotiation'),
  },
  'call-room': {
    empty: () => evidence('call'),
    loading: () => evidence('call'),
    error: () => evidence('call'),
    completed: () => evidence('call'),
    keyboard: () => evidence('call'),
    touch: () => evidence('call'),
  },
  'sales-delivery': {
    empty: () => evidence('sales'),
    loading: sharedLoading,
    error: () => evidence('sales'),
    completed: () => evidence('sales'),
    keyboard: () => evidence('sales'),
    touch: () => evidence('sales'),
  },
  fieldwork: {
    empty: () => evidence('fieldwork'),
    loading: () => evidence('fieldwork'),
    error: () => evidence('fieldwork'),
    completed: () => evidence('fieldwork'),
    keyboard: () => evidence('fieldwork'),
    touch: () => evidence('fieldwork'),
  },
  crm: {
    empty: () => evidence('crm-review', 'advanced-labs'),
    loading: sharedLoading,
    error: () => evidence('crm-review'),
    completed: () => evidence('crm-review', 'advanced-labs'),
    keyboard: () => evidence('crm-review', 'advanced-labs'),
    touch: () => evidence('crm-review', 'advanced-labs'),
  },
  workflow: {
    empty: () => evidence('workflow'),
    loading: sharedLoading,
    error: () => evidence('workflow', 'remediation-draft'),
    completed: () => evidence('workflow', 'remediation-exercise'),
    keyboard: () => evidence('workflow', 'remediation-keyboard'),
    touch: () => evidence('workflow', 'remediation-draft'),
  },
  funnel: {
    empty: () => evidence('funnel'),
    loading: sharedLoading,
    error: () => evidence('funnel'),
    completed: () => evidence('funnel'),
    keyboard: () => evidence('funnel'),
    touch: () => evidence('funnel'),
  },
  calendar: {
    empty: () => evidence('calendar', 'advanced-labs'),
    loading: sharedLoading,
    error: () => evidence('calendar'),
    completed: () => evidence('calendar', 'advanced-labs'),
    keyboard: () => evidence('calendar'),
    touch: () => evidence('calendar'),
  },
  reporting: {
    empty: () => evidence('reporting'),
    loading: sharedLoading,
    error: sharedError,
    completed: () => evidence('reporting'),
    keyboard: () => evidence('reporting'),
    touch: () => evidence('reporting'),
  },
  payments: {
    empty: () => evidence('advanced-labs'),
    loading: sharedLoading,
    error: () => evidence('advanced-labs'),
    completed: () => evidence('advanced-labs'),
    keyboard: () => evidence('advanced-labs'),
    touch: () => evidence('advanced-labs'),
  },
  incident: {
    empty: () => evidence('incident'),
    loading: sharedLoading,
    error: () => evidence('incident'),
    completed: () => evidence('incident'),
    keyboard: () => evidence('incident'),
    touch: () => evidence('incident'),
  },
  conversations: {
    empty: () => evidence('workflow'),
    loading: sharedLoading,
    error: sharedError,
    completed: () => evidence('workflow'),
    keyboard: () => evidence('workflow', 'remediation-keyboard'),
    touch: () => evidence('workflow'),
  },
  clients: {
    empty: () => evidence('clients', 'remediation-home'),
    loading: () => evidence('clients'),
    error: () => evidence('clients'),
    completed: () => evidence('clients'),
    keyboard: () => evidence('clients'),
    touch: () => evidence('clients', 'remediation-home'),
  },
  portfolio: {
    empty: () => evidence('portfolio'),
    loading: sharedLoading,
    error: () => evidence('portfolio'),
    completed: () => evidence('portfolio'),
    keyboard: () => evidence('portfolio'),
    touch: () => evidence('portfolio'),
  },
  'field-ready': {
    empty: () => evidence('moments'),
    loading: sharedLoading,
    error: sharedError,
    completed: () => evidence('moments', 'clients'),
    keyboard: () => evidence('moments', 'clients'),
    touch: () => evidence('moments', 'clients'),
  },
  playground: {
    empty: () => evidence('workflow'),
    loading: sharedLoading,
    error: sharedError,
    completed: () => evidence('workflow'),
    keyboard: () => evidence('workflow', 'remediation-keyboard'),
    touch: () => evidence('workflow'),
  },
  'ai-settings': {
    empty: () => evidence('connect'),
    loading: sharedLoading,
    error: () => evidence('connect'),
    completed: () => evidence('connect'),
    keyboard: () => evidence('connect'),
    touch: () => evidence('connect'),
  },
  sync: {
    empty: () => evidence('restore', 'sync'),
    loading: () => evidence('restore', 'sync'),
    error: () => evidence('restore', 'sync'),
    completed: () => evidence('restore', 'sync'),
    keyboard: () => evidence('restore', 'sync'),
    touch: () => evidence('restore', 'sync'),
  },
  search: {
    empty: () => evidence('search'),
    loading: () => evidence('search'),
    error: () => evidence('search'),
    completed: () => evidence('search'),
    keyboard: () => evidence('search', 'remediation-keyboard'),
    touch: () => evidence('search'),
  },
  'not-found': {
    empty: () =>
      notApplicable(
        'The screen is itself the explicit unknown-route state and contains recovery navigation.',
      ),
    loading: sharedLoading,
    error: sharedError,
    completed: () => notApplicable('An unknown route has no completion/result lifecycle.'),
    keyboard: () => evidence('a11y'),
    touch: () => evidence('polish'),
  },
};

const polishPath = resolve(evidenceRoot, 'polish', 'polish-probe.json');
assert(existsSync(polishPath), `Missing layout evidence: ${polishPath}`);
const polish = JSON.parse(readFileSync(polishPath, 'utf8'));
assert.equal(polish.status, 'PASSED');
assert.deepEqual(polish.requiredWidths, REQUIRED_WIDTHS);
assert.equal(polish.screens.length, SCREEN_INVENTORY.length * REQUIRED_WIDTHS.length);

const cells = ['empty', 'loading', 'error', 'completed', 'keyboard', 'touch'];
const rows = SCREEN_INVENTORY.map((screen) => {
  const policy = FAMILY[screen.family];
  assert(policy, `Missing state policy for ${screen.family}`);
  const layouts = Object.fromEntries(
    REQUIRED_WIDTHS.map((width) => {
      const observed = polish.screens.find(
        (row) => row.name === screen.name && row.width === width,
      );
      assert(
        observed && observed.failures.length === 0,
        `Missing clean ${screen.name} ${width} layout`,
      );
      assert(
        existsSync(resolve(evidenceRoot, 'polish', `${screen.name}-${width}.png`)),
        `Missing screenshot for ${screen.name} ${width}`,
      );
      return [
        width,
        {
          status: 'PROVEN_BROWSER',
          artifact: relative(
            process.cwd(),
            resolve(evidenceRoot, 'polish', `${screen.name}-${width}.png`),
          ).replaceAll('\\', '/'),
          density: observed.density,
          prohibited_signals: observed.prohibitedSignals,
        },
      ];
    }),
  );
  const states = Object.fromEntries(cells.map((cell) => [cell, policy[cell]()]));
  const reduced = polish.screens.find((row) => row.name === screen.name && row.width === 390);
  assert(reduced?.reducedMotion?.checked, `Missing reduced-motion check for ${screen.name}`);
  return {
    ...screen,
    layouts,
    states,
    reduced_motion: {
      status: 'PROVEN_BROWSER',
      probe: 'polish',
      width: 390,
      visible_animations: reduced.reducedMotion.visibleAnimations,
      infinite_animations: reduced.reducedMotion.infinite,
    },
    human_visual_review: {
      status: 'REQUIRED',
      reason:
        'Screenshots and density/slop measurements are evidence, not human hierarchy, material, or long-session judgment.',
    },
  };
});

const mobileRecompositions = [
  {
    environment: 'Workflow Lab',
    composition: 'vertical step editor with inspector/palette sheets and Timeline tab',
    probes: ['workflow'],
    sources: ['apps/web/src/workflow/WorkflowLab.tsx', 'apps/web/src/workflow/workflow.module.css'],
  },
  {
    environment: 'CRM Lab',
    composition: 'one-stage viewport, named stage switcher and non-drag stage picker',
    probes: ['crm-review', 'advanced-labs'],
    sources: ['apps/web/src/crm/PipelineBoard.tsx', 'apps/web/src/crm/crm.module.css'],
  },
  {
    environment: 'Academy',
    composition: 'single reading column with touch-operable disclosure, completion and embed',
    probes: ['academy', 'polish'],
    sources: [
      'apps/web/src/academy/AcademyUnit.tsx',
      'apps/web/src/academy/AcademyUnit.module.css',
    ],
  },
  {
    environment: 'Call Room',
    composition: 'very-low-density single column retaining notes, voice and recovery controls',
    probes: ['call'],
    sources: ['apps/web/src/call/CallRoom.tsx', 'apps/web/src/call/call.module.css'],
  },
  {
    environment: 'Inbox',
    composition: 'thread list followed by one selected conversation and its composer',
    probes: ['workflow', 'polish'],
    sources: [
      'apps/web/src/conversations/ConversationsLab.tsx',
      'apps/web/src/conversations/conversations.module.css',
    ],
  },
  {
    environment: 'Skill Map',
    composition: 'territory-first single column preserving semantic order and touch selection',
    probes: ['advanced-paths', 'polish'],
    sources: ['apps/web/src/screens/SkillMap.tsx', 'apps/web/src/screens/SkillMap.module.css'],
  },
].map((row) => {
  const browser = evidence(...row.probes);
  return {
    ...row,
    status: 'PROVEN_BROWSER_AND_SOURCE',
    widths: [390, 320],
    artifacts: browser.artifacts,
  };
});

const report = {
  schema_version: 2,
  requirement: {
    id: 'DES-018',
    status: 'IN_PROGRESS',
    reason: 'Family-level probe references still need exact screen/state/input assertion mapping.',
  },
  head: suite.head,
  base: suite.base,
  generated_from: [
    'apps/web/src/app/routes.tsx',
    '.content/bundle.json',
    relative(process.cwd(), suitePath).replaceAll('\\', '/'),
  ],
  required_widths: REQUIRED_WIDTHS,
  screens: rows,
  mobile_recompositions: mobileRecompositions,
  summary: {
    screens: rows.length,
    layout_cells: rows.length * REQUIRED_WIDTHS.length,
    state_cells: rows.length * (cells.length + 1),
    n_a_cells: rows
      .flatMap((row) => Object.values(row.states))
      .filter((cell) => cell.status === 'N/A').length,
    shared_contract_cells: rows
      .flatMap((row) => Object.values(row.states))
      .filter((cell) => cell.status === 'PROVEN_SHARED_ROUTE_CONTRACT').length,
    unverified_state_cells: rows
      .flatMap((row) => Object.values(row.states))
      .filter((cell) => cell.status === 'RELATED_BROWSER_EVIDENCE').length,
    human_visual_rows_required: rows.length,
  },
};
writeFileSync(resolve(out, 'screen-state-matrix.json'), `${JSON.stringify(report, null, 2)}\n`);
const cellWord = (cell) =>
  cell.status === 'N/A'
    ? `N/A — ${cell.reason}`
    : `${cell.status.replaceAll('_', ' ')} — ${(cell.probes ?? cell.sources ?? []).join(', ')}`;
writeFileSync(
  resolve(out, 'screen-state-matrix.md'),
  [
    '# Field-Ready screen/state evidence matrix',
    '',
    `Exact head: \`${report.head}\``,
    'DES-018: IN_PROGRESS. Related probe references are not proof of every semantic/input cell.',
    `Unverified semantic/input cells: ${report.summary.unverified_state_cells}`,
    `Learner screens: ${report.summary.screens}`,
    `Five-width layout cells: ${report.summary.layout_cells}`,
    `State/input cells: ${report.summary.state_cells}`,
    `Explicit N/A cells: ${report.summary.n_a_cells}`,
    `Shared route-contract cells: ${report.summary.shared_contract_cells}`,
    '',
    'Every human visual-review cell remains REQUIRED; automated screenshots and measurements do not certify hierarchy, material, or long-session comfort.',
    '',
    '## Named mobile recompositions',
    '',
    '| Environment | 390 / 320 composition | Evidence |',
    '| --- | --- | --- |',
    ...mobileRecompositions.map(
      (row) => `| ${row.environment} | ${row.composition} | ${row.probes.join(', ')} |`,
    ),
    '',
    '## Screen states',
    '',
    '| Screen | Default + widths | Empty | Loading | Error | Completed/result | Keyboard | Touch | Reduced motion |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...rows.map(
      (row) =>
        `| ${row.name} | Browser ${REQUIRED_WIDTHS.join('/')} | ${cellWord(row.states.empty)} | ${cellWord(row.states.loading)} | ${cellWord(row.states.error)} | ${cellWord(row.states.completed)} | ${cellWord(row.states.keyboard)} | ${cellWord(row.states.touch)} | Browser 390; infinite ${row.reduced_motion.infinite_animations.length} |`,
    ),
    '',
  ].join('\n'),
);
console.log(
  `Screen/state matrix: ${report.summary.screens} screens, ${report.summary.layout_cells} layout cells, ${report.summary.state_cells} state/input cells; ${report.summary.human_visual_rows_required} human visual rows remain required.`,
);

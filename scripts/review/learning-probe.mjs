// Two-device learning-engine check (Phase 6; MAS-001 … MAS-011, DATA-001, SYNC-001): two
// separate headless Chrome profiles against one server. Device A links, records independent
// evidence through the diagnostic form and syncs; device B links with the key and receives
// the evidence and the same derived skill and campaign rows; B records a worked-example pass
// offline and reconnects; A receives it and both devices agree on every derived row.
//   BASE=https://bloomlab-preview.example.workers.dev node scripts/review/learning-probe.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { screenshot, setViewport, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';

const OUT = resolve(process.env.REVIEW_OUT ?? '.review');
const BASE = process.env.BASE ?? 'http://localhost:4173';
const {
  waitFor,
  bodyHas,
  testText,
  click,
  selectOption,
  indicator,
  syncNow,
  device,
  createKeyAndLink,
  linkWithKey,
} = probeHelpers({ base: BASE });

const SKILL = 'SK-STRATEGIZE-funnel-math';
const SKILL_B = 'SK-AUTOMATE-workflow-foundations';

mkdirSync(OUT, { recursive: true });
const report = { base: BASE, steps: [] };
const step = (name, data) => {
  report.steps.push({ name, ...data });
  console.log(name, JSON.stringify(data));
};

/** Every derived row as the page shows it, keyed by test id, for cross-device comparison. */
const derivedRows = (page) =>
  page.evaluate(
    "Object.fromEntries([...document.querySelectorAll('[data-testid^=skill-], [data-testid^=campaign-], [data-testid^=review-]')].map((el) => [el.dataset.testid, el.textContent.trim().replace(/\\s+/g, ' ')]))",
  );

async function recordEvidence(
  page,
  { skill, kind = 'independent_exercise', result = 'passed', hints = [] },
) {
  await waitFor(page, "!!document.querySelector('[data-testid=evidence-skill]')");
  if (!(await selectOption(page, 'evidence-skill', skill)))
    throw new Error(`cannot select ${skill}`);
  await selectOption(page, 'evidence-kind', kind);
  await selectOption(page, 'evidence-result', result);
  for (const hint of hints) await click(page, `[data-testid=hint-${hint}]`);
  await click(page, 'Record evidence');
  await waitFor(page, `(${testText('evidence-message')} || '').startsWith('Recorded')`);
  for (const hint of hints) await click(page, `[data-testid=hint-${hint}]`); // untick for the next entry
  return testText('evidence-message');
}

const A = await device('A');
const B = await device('B');
try {
  // ---------- A links, records independent evidence, syncs ----------
  const { key, linked } = await createKeyAndLink(A);
  await A.go('/system');
  const message = await recordEvidence(A.page, { skill: SKILL });
  const rowShown = await waitFor(
    A.page,
    `(${testText(`skill-${SKILL}`)} || '').includes('Independent')`,
  );
  const queuedBefore = await A.page.evaluate(bodyHas('sync_queue'));
  const aRowsBefore = await derivedRows(A.page);
  await syncNow(A.page);
  step('A linked and recorded independent evidence locally, then synced', {
    linked,
    message: await A.page.evaluate(message),
    rowShown,
    queuedBefore,
    skillRow: aRowsBefore[`skill-${SKILL}`],
    campaignRow: aRowsBefore['campaign-CAMP-FIELD_READY'],
    aIndicator: await indicator(A.page),
  });

  // ---------- B links and receives the evidence and the derived rows ----------
  const bLinked = await linkWithKey(B, key);
  await B.go('/system');
  await syncNow(B.page);
  const bHasRow = await waitFor(
    B.page,
    `(${testText(`skill-${SKILL}`)} || '').includes('Independent')`,
  );
  const aRows = await derivedRows(A.page);
  const bRows = await derivedRows(B.page);
  const recentOnB = await B.page.evaluate(
    "[...document.querySelectorAll('[data-testid=recent-evidence] li')].map((li) => li.textContent.trim().replace(/\\s+/g, ' ').slice(0, 120))",
  );
  step('B linked and received the evidence and the same derived rows', {
    bLinked,
    bHasRow,
    sameSkillRow: aRows[`skill-${SKILL}`] === bRows[`skill-${SKILL}`],
    sameCampaignRow: aRows['campaign-CAMP-FIELD_READY'] === bRows['campaign-CAMP-FIELD_READY'],
    bRecentEvidence: recentOnB,
  });

  // ---------- B records a worked-example pass offline, then reconnects ----------
  await B.setOffline(true);
  await recordEvidence(B.page, {
    skill: SKILL_B,
    kind: 'deterministic_exercise',
    hints: ['worked_example'],
  });
  const bGuided = await waitFor(
    B.page,
    `(${testText(`skill-${SKILL_B}`)} || '').includes('Guided')`,
  );
  const bOfflineIndicator = await indicator(B.page);
  const bQueued = await B.page.evaluate(
    '(() => { const m = document.body.textContent.match(/sync_queue (\\d+)/); return m ? Number(m[1]) : null; })()',
  );
  await B.setOffline(false);
  await syncNow(B.page);
  await syncNow(A.page);
  const aGuided = await waitFor(
    A.page,
    `(${testText(`skill-${SKILL_B}`)} || '').includes('Guided')`,
  );
  const finalA = await derivedRows(A.page);
  const finalB = await derivedRows(B.page);
  const keys = [...new Set([...Object.keys(finalA), ...Object.keys(finalB)])].sort();
  const differences = keys.filter((k) => finalA[k] !== finalB[k]);
  step('B recorded a heavily assisted pass offline; after reconnect both devices agree', {
    bGuided,
    bOfflineIndicator,
    bQueuedWhileOffline: bQueued,
    aGuided,
    rows: keys.length,
    differences,
    workedExampleNotIndependent: (finalA[`skill-${SKILL_B}`] ?? '').includes('independent 0/'),
  });

  // ---------- phone-width capture of the Learning section on B ----------
  await setViewport(B.page, 390, 900, { mobile: true });
  await B.page.evaluate(
    "[...document.querySelectorAll('h2')].find((h) => h.textContent === 'Learning')?.scrollIntoView({ block: 'start' })",
  );
  await sleep(400);
  const overflow = await B.page.evaluate(
    'document.documentElement.scrollWidth > window.innerWidth',
  );
  await screenshot(B.page, `${OUT}/learning-b-390.png`, undefined, false);
  step('phone width', { overflow390: overflow, capture: 'learning-b-390.png' });

  const ok =
    report.steps.every((s) =>
      Object.entries(s).every(([k, v]) =>
        !(typeof v === 'boolean') || k.startsWith('overflow') ? true : v,
      ),
    ) &&
    !overflow &&
    differences.length === 0;
  report.ok = ok;
  console.log('ok:', ok);
} finally {
  writeFileSync(`${OUT}/learning-probe.json`, JSON.stringify(report, null, 2));
  await A.close();
  await B.close();
}
process.exit(report.ok ? 0 : 1);

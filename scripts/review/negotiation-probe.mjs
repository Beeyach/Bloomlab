// Real product probe. UI input drives every turn; IndexedDB is read only to verify persistence
// and hidden transitions. No component mock, engine injected into the page or fabricated state.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  openPage,
  resetIndexedDbFixture,
  screenshot,
  session,
  setViewport,
  sleep,
} from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = resolve(process.env.REVIEW_OUT ?? '.review');
mkdirSync(OUT, { recursive: true });
const ID = 'EX-NEGOTIATE_IT-summit-freelancer-quote';
const { waitFor, click, typeInto, selectOption } = probeHelpers({ base: BASE });
const report = { base: BASE, sections: {} };
let failures = 0;
const section = (name, checks, extra = {}) => {
  const passed = Object.values(checks).every((v) => v === true);
  if (!passed) failures++;
  report.sections[name] = { passed, checks, ...extra };
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(checks)}`);
};
const selector = (id) => `[data-testid="${id}"]`;
const exists = (id) => `!!document.querySelector(${JSON.stringify(selector(id))})`;
const text = async (page, id) =>
  page.evaluate(`document.querySelector(${JSON.stringify(selector(id))})?.textContent??''`);
const saved = async (page, table = 'workspace') =>
  page.evaluate(
    `new Promise((resolve,reject)=>{const request=indexedDB.open('bloomlab');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result;const tx=db.transaction(${JSON.stringify(table)},'readonly');const read=tx.objectStore(${JSON.stringify(table)}).getAll();read.onsuccess=()=>{const rows=read.result;db.close();resolve(${table === 'workspace' ? `rows.find(r=>r.key==='exercise.attempt.${ID}')?.value??null` : `rows.filter(r=>r.exercise_id==='${ID}').at(-1)??null`});};read.onerror=()=>reject(read.error);};})`,
  );
const state = async (page) => (await saved(page))?.response?.negotiation;
async function fresh(page) {
  await resetIndexedDbFixture(page, BASE);
  await openPage(page, `${BASE}/exercise/${ID}`);
  if (!(await waitFor(page, exists('neg-reply'))))
    throw new Error('Real NEGOTIATE IT did not open');
}
async function move(page, kind, options = {}) {
  const count = (await state(page))?.turns.length ?? 0;
  if (kind) await click(page, selector(`neg-action-${kind}`));
  for (const [id, value] of Object.entries(options.select ?? {}))
    await selectOption(page, `neg-${id}`, value);
  for (const id of options.remove ?? []) await click(page, selector(`neg-remove-${id}`));
  for (const [id, value] of Object.entries(options.amounts ?? {}))
    await typeInto(page, selector(`neg-${id}`), String(value));
  await typeInto(
    page,
    selector('neg-reply'),
    options.text ?? 'I can commit to the work and terms we have explicitly agreed.',
  );
  await click(page, selector('neg-send'));
  for (let i = 0; i < 80; i++) {
    const s = await state(page);
    if (s?.turns.length > count) return s;
    await sleep(100);
  }
  throw new Error('Turn did not persist');
}
const diagnose = (page) =>
  move(page, 'clarify', {
    select: { diagnosis: 'constraint' },
    text: 'The booking connection leaves qualification and applicant follow-up out. Can we compare those responsibilities?',
  });
async function finish(page) {
  for (let i = 0; i < 20; i++) {
    const s = await state(page);
    if (s?.status !== 'open') return s;
    await move(page, 'hold_price');
  }
  throw new Error('Conversation did not terminate');
}
async function grade(page) {
  await click(page, 'Run it');
  if (
    !(await waitFor(
      page,
      `!!document.querySelector('[data-outcome]') || [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Retry evaluation')`,
    ))
  )
    throw new Error('No saved grade');
  const finalized = await saved(page, 'exercise_attempts');
  if (finalized) return finalized;
  const checkpoint = await saved(page);
  if (!checkpoint?.submitted) throw new Error('No saved submission checkpoint');
  return { grade: checkpoint.submitted.report, pending: true };
}
async function hiddenAudit(page) {
  return page.evaluate(
    `(()=>{const root=document.querySelector('[data-testid=negotiation]');if(!root)return false;const html=root.outerHTML;return !/(?:trust|urgency|price_sensitivity|frustration|technical_sophistication|actual_budget|stated_budget|decision_authority|fear|previous_bad_experience|alternative_provider_strength)[_\\s:="<>-]{0,25}\\d|trust meter|budget gauge|type="hidden"|<progress/i.test(html) && !/3500|3,500/.test(html);})()`,
  );
}
const { page, close } = await session();
try {
  await setViewport(page, 1440, 1000, { mobile: false });
  await fresh(page);
  section('real-exercise-ai-off', {
    opens: await page.evaluate(exists('negotiation')),
    sixActions: await page.evaluate(
      "document.querySelectorAll('input[name=neg-action]').length===6",
    ),
    noAi: !(await page.evaluate(
      "performance.getEntriesByType('resource').some(e=>/anthropic|ai-gateway|openai\\.com/.test(e.name))",
    )),
    hidden: await hiddenAudit(page),
  });
  let s = await move(page, null, {
    text: 'Maybe we can meet halfway, but I do not mean a discount. Or perhaps stages?',
  });
  section('low-confidence', {
    fallback: s.turns[0].fallback,
    confidenceZero: s.turns[0].classification.confidence === 0,
    noGuess: s.turns[0].classification.strategy === null,
    noNewOffer: s.turns[0].offer === null,
    nodeUnchanged: s.node === 'competitor_price',
  });
  await fresh(page);
  s = await diagnose(page);
  section('trust-plus-ten', {
    exact: s.hidden.trust === 65,
    latestText: s.turns[0].action.text.includes('qualification'),
    latestAction: s.turns[0].action.action === 'clarify',
  });
  s = await move(page, 'hold_price');
  const trustedReply = s.turns.at(-1).reply;
  section('hidden-state-changes-later-reply', { reacted: trustedReply.includes('You listened') });
  await typeInto(page, selector('neg-reply'), 'Keep this unfinished message after reload.');
  await click(page, selector('neg-action-walk_away'));
  await sleep(200);
  const before = await state(page);
  await page.send('Page.reload');
  await waitFor(page, exists('neg-reply'));
  const after = await state(page);
  section('reload-midway', {
    sameState: JSON.stringify(before) === JSON.stringify(after),
    text: await page.evaluate(
      "document.querySelector('[data-testid=neg-reply]').value==='Keep this unfinished message after reload.'",
    ),
    selection: await page.evaluate(
      "document.querySelector('[data-testid=neg-action-walk_away]').checked",
    ),
  });
  s = await move(page, 'walk_away', {
    text: 'I cannot responsibly deliver the full scope on those terms. We can revisit a smaller brief.',
  });
  let result = await grade(page);
  section('professional-walk-away', {
    lostDeal: s.status === 'walked_away',
    highScore: result.grade.score === 100,
    pending: result.grade.reason === 'rubric_pending',
    hidden: await hiddenAudit(page),
  });
  await page.send('Page.reload');
  await waitFor(page, exists('neg-terminal'));
  section('reload-completed', {
    conversation: (await text(page, 'neg-dialogue')).includes('smaller brief'),
    hidden: await hiddenAudit(page),
  });
  section('saved-ai-failure', {
    checkpoint: Boolean((await saved(page))?.submitted),
    noFinalizedHistory: !(await saved(page, 'exercise_attempts')),
  });
  await fresh(page);
  s = await move(page, 'hold_price', { select: { approach: 'pitch' } });
  section('trust-minus-eight', { exact: s.hidden.trust === 47 });
  s = await move(page, 'hold_price');
  section('lower-trust-different-reply', { different: s.turns.at(-1).reply !== trustedReply });
  await fresh(page);
  s = await move(page, 'hold_price', { select: { approach: 'ignore' } });
  section('frustration-plus-fifteen', { exact: s.hidden.frustration === 45 });
  s = await move(page, 'hold_price');
  s = await move(page, 'hold_price');
  section('frustration-changes-later-reply', {
    reacted: s.turns.at(-1).reply.includes('moving past'),
  });
  await fresh(page);
  s = await move(page, 'hold_price', { select: { approach: 'defensive' } });
  section('defensive-reaction', {
    strategy: s.turns[0].classification.strategy === 'defensive',
    authored: s.turns[0].reply.includes('does not answer'),
  });
  await fresh(page);
  await diagnose(page);
  s = await move(page, 'concession', {
    select: { concession: 'discount_free' },
    amounts: { project: 900 },
  });
  section('discount-reaction', {
    strategy: s.turns.at(-1).classification.strategy === 'discount',
    sameScope: s.deal.quote.excluded.length === 0,
    fee: s.deal.quote.project === 900,
  });
  s = await finish(page);
  result = await grade(page);
  section('bad-win-fails', {
    won: s.status === 'won',
    failed: result.grade.outcome === 'failed',
    critical: result.grade.reason === 'critical_failure',
  });
  await click(page, 'Try again');
  await waitFor(page, exists('neg-reply'));
  await move(page, null, { text: 'Begin a new attempt without inheriting the old relationship.' });
  s = await state(page);
  section('fresh-retry', {
    trustReset: s.hidden.trust === 55,
    frustrationReset: s.hidden.frustration === 30,
    oneNewTurn: s.turns.length === 1,
  });
  await fresh(page);
  await diagnose(page);
  s = await move(page, 'reduce_scope', {
    remove: ['typeform_migration', 'handover'],
    amounts: { project: 1600 },
  });
  section('structural-scope-reduction', {
    removed: s.deal.quote.excluded.length === 2,
    consequence: (await text(page, 'neg-agreement')).includes('Marcus retypes'),
    strategy: s.turns.at(-1).classification.strategy === 'reduce_scope',
  });
  await move(page, 'walk_away');
  result = await grade(page);
  section('lower-price-defensible', {
    score: result.grade.score === 100,
    noCritical: result.grade.failed_critical.length === 0,
  });
  await fresh(page);
  await diagnose(page);
  s = await move(page, 'phase', {
    select: { phase: 'applications_first' },
    amounts: { project: 1650, phase_two_project: 750 },
  });
  section('real-two-stage-delivery', {
    phase: s.deal.phase?.deferred.length === 3,
    fees: s.deal.quote.project === 1650 && s.deal.phase.project === 750,
    structure: (await text(page, 'neg-agreement')).includes('Phase 2'),
    strategy: s.turns.at(-1).classification.strategy === 'phase',
  });
  await move(page, 'walk_away');
  result = await grade(page);
  section('phase-economics', {
    score: result.grade.score === 100,
    noCritical: result.grade.failed_critical.length === 0,
  });
  await fresh(page);
  s = await move(page, 'concession', { select: { concession: 'revision_trade' } });
  section('concession-is-a-trade', {
    strategy: s.turns[0].classification.strategy === 'hold',
    extraRound: s.deal.quote.revisions === 1,
    laterDelivery: s.deal.quote.timeline_days === 28,
    feeUnchanged: s.deal.quote.project === 2400,
  });
  s = await move(page, 'concession', { select: { concession: 'balance_later' } });
  section('payment-consequence', {
    balanceLater: s.deal.balance_days === 30,
    largerDeposit: s.deal.quote.deposit.value === 60,
  });
  s = await move(page, 'concession', { select: { concession: 'deposit_lower' } });
  section('deposit-consequence', {
    lowerDeposit: s.deal.quote.deposit.value === 25,
    longerTimeline: s.deal.quote.timeline_days === 28,
  });
  await fresh(page);
  const objections = [];
  for (let i = 0; i < 10; i++) {
    const current = (await state(page))?.node ?? 'competitor_price';
    objections.push(current);
    await diagnose(page);
  }
  s = await state(page);
  section(
    'all-ten-executable-objections',
    {
      ten: new Set(objections).size === 10,
      terminal: s.status !== 'open',
      allAuthored: s.turns.every((t) => !t.fallback && t.reply !== 'Correct.'),
    },
    { objections },
  );
  await fresh(page);
  await diagnose(page);
  await move(page, 'phase', {
    select: { phase: 'applications_first' },
    amounts: { project: 2400, phase_two_project: 700, timeline_days: 1 },
  });
  s = await finish(page);
  result = await grade(page);
  section('impossible-timeline-win-fails', {
    won: s.status === 'won',
    failed: result.grade.reason === 'required_failure',
  });
  await fresh(page);
  await diagnose(page);
  while ((await state(page)).status === 'open')
    await move(page, null, { text: 'Perhaps. I have no clearer move to offer.' });
  result = await grade(page);
  section('fallback-exhaustion-fails', {
    failed: result.grade.outcome === 'failed',
    gate: result.grade.reason === 'required_failure',
  });
  for (const width of [1440, 1024, 768, 390, 320]) {
    await fresh(page);
    await setViewport(page, width, 950);
    await click(page, selector('neg-action-phase'));
    await selectOption(page, 'neg-phase', 'applications_first');
    await sleep(200);
    const sizes = await page.evaluate(
      '({width:innerWidth,scroll:document.documentElement.scrollWidth})',
    );
    section(
      `width-${width}`,
      {
        noOverflow: sizes.scroll <= sizes.width + 1,
        hidden: await hiddenAudit(page),
        sixActions: await page.evaluate(
          "document.querySelectorAll('input[name=neg-action]').length===6",
        ),
      },
      sizes,
    );
    await page.evaluate(
      "document.querySelector('[data-testid=negotiation]').scrollIntoView({block:'start'})",
    );
    const overlap = await page.evaluate(
      `(() => { const brief = document.querySelector('[aria-labelledby=brief-title]').getBoundingClientRect(); const work = document.querySelector('[data-testid=negotiation]').getBoundingClientRect(); return brief.bottom > work.top; })()`,
    );
    section(`brief-clear-${width}`, { noOverlap: !overlap });
    await screenshot(page, resolve(OUT, `negotiation-${width}.png`), null, false);
  }
  await fresh(page);
  await setViewport(page, 390, 844, { mobile: true });
  const touch = async (id) => {
    const box = await page.evaluate(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector(id))});el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [box] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  await touch('neg-action-walk_away');
  await typeInto(page, selector('neg-reply'), 'We can leave the door open for a different brief.');
  await touch('neg-send');
  await waitFor(page, exists('neg-terminal'));
  section('touch', { terminal: await page.evaluate(exists('neg-terminal')) });
  await fresh(page);
  await setViewport(page, 1024, 900, { mobile: false });
  await page.evaluate("document.querySelector('[data-testid=neg-action-clarify]').focus()");
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'ArrowRight',
    code: 'ArrowRight',
    windowsVirtualKeyCode: 39,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'ArrowRight',
    code: 'ArrowRight',
    windowsVirtualKeyCode: 39,
  });
  section('keyboard', {
    radioNavigation: await page.evaluate(
      "document.querySelector('[data-testid=neg-action-hold_price]').checked",
    ),
    focusVisible: await page.evaluate("document.activeElement.matches(':focus-visible')"),
  });
  await typeInto(page, selector('neg-reply'), 'I will keep the stated scope and terms clear.');
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  const sendFocused = await page.evaluate("document.activeElement?.dataset.testid==='neg-send'");
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
    text: '\r',
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  for (let i = 0; i < 80 && (await state(page)).turns.length === 0; i++) await sleep(100);
  section('keyboard-send', { sendFocused, turnSent: (await state(page)).turns.length === 1 });
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await move(page, 'walk_away');
  section('reduced-motion', {
    media: await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"),
    terminal: await page.evaluate(exists('neg-terminal')),
    hidden: await hiddenAudit(page),
  });
} finally {
  await close();
  writeFileSync(
    resolve(OUT, 'negotiation-probe.json'),
    JSON.stringify({ ...report, failures }, null, 2) + '\n',
  );
}
if (failures) process.exitCode = 1;

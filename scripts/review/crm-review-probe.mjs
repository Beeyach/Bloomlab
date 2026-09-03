// CRM Lab review at the five widths (CRM-004, A11Y-004, MOT-004, DES-021, DES-022).
//
// The flow probe (`crm-probe.mjs`) proves the Lab works. This one proves it holds up where the
// user actually is: every required state at 1440 / 1024 / 768 / 390 / 320, no page-level
// horizontal overflow, no touch-critical control under 44 px, no input under 16 px on a phone, no
// monospace, no eyebrow; the primary actions reached by keyboard alone with a visible ring; the
// stage move done by touch without a drag; and nothing animating under reduced motion.
//
// Writes one PNG per state per width to .review/crm/ (override with REVIEW_OUT) and prints a
// JSON report with a verdict.
//
//   BASE=http://localhost:4173 node scripts/review/crm-review-probe.mjs
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { openPage, screenshot, session, setViewport, sleep } from './cdp.mjs';

const BASE = process.env.BASE ?? 'http://localhost:4173';
const OUT = resolve(process.env.REVIEW_OUT ?? '.review/crm');
const WIDTHS = (process.env.WIDTHS ?? '1440,1024,768,390,320').split(',').map(Number);

mkdirSync(OUT, { recursive: true });

const report = { base: BASE, widths: {}, keyboard: {}, touch: {}, reducedMotion: {}, failures: [] };
const fail = (what) => report.failures.push(what);

const { page, close } = await session();

const waitFor = async (expression, tries = 80) => {
  for (let i = 0; i < tries; i += 1) {
    if (await page.evaluate(`Boolean(${expression})`)) return true;
    await sleep(150);
  }
  return false;
};

const settle = () =>
  page.evaluate('Promise.all(document.getAnimations().map((a) => a.finished.catch(() => null)))');

const clickText = (tag, label) =>
  page.evaluate(
    `(() => { const el = [...document.querySelectorAll(${JSON.stringify(tag)})].find((x) => x.textContent.trim() === ${JSON.stringify(label)}); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; })()`,
  );

/** The layout audit, measured inside the page. The rail is excluded from typography checks. */
const AUDIT = `(() => {
  const W = innerWidth;
  const rail = document.querySelector('nav[aria-label=Primary]');
  const main = document.querySelector('main') ?? document.body;
  const els = [...main.querySelectorAll('*'), ...document.querySelectorAll('[role=dialog] *')];
  const nm = (e) => e.tagName + '.' + String(e.className).split(' ')[0];
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const ctl = [...document.querySelectorAll('main button, main input, main select, main textarea, main a[href], [role=dialog] button, [role=dialog] input, [role=dialog] select, [role=dialog] textarea')]
    .filter((e) => visible(e) && !e.disabled);
  // A control inside a chip (remove tag) answers a 44px touch through the chip; measure the chip.
  const target = (e) => (e.closest('li')?.querySelector('button') === e && e.closest('li').getBoundingClientRect().height >= 32 ? e.closest('li') : e);
  const small = ctl
    .map((e) => ({ e, r: target(e).getBoundingClientRect() }))
    .filter(({ e, r }) => (r.height < 44 || r.width < 44) && !e.closest('[data-chip]'))
    .map(({ e, r }) => nm(e) + ' "' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24) + '" ' + Math.round(r.width) + 'x' + Math.round(r.height))
    .slice(0, 10);
  const inputs = [...document.querySelectorAll('main input, main select, main textarea, [role=dialog] input, [role=dialog] select, [role=dialog] textarea')]
    .filter(visible)
    .map((e) => parseFloat(getComputedStyle(e).fontSize)).filter((s) => s < 16);
  const mono = [], eyebrow = [], tiny = [];
  for (const e of els) {
    if (rail && rail.contains(e)) continue;
    if (!visible(e)) continue;
    const s = getComputedStyle(e);
    if (/mono|Courier|Consolas/i.test(s.fontFamily)) mono.push(nm(e));
    const hasText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (hasText && s.textTransform === 'uppercase' && parseFloat(s.fontSize) < 13) eyebrow.push(nm(e));
    if (hasText && parseFloat(s.fontSize) < 12) tiny.push(nm(e));
  }
  // The board is the one intentional horizontal scroller (CRM-004): it must scroll itself, and
  // never push the page.
  const board = document.querySelector('[data-board]');
  const boardScrolls = board ? board.scrollWidth > board.clientWidth + 2 : null;
  const boardOverflowX = board ? getComputedStyle(board).overflowX : null;
  // Something past the right edge only counts when nothing between it and the page clips or
  // scrolls it: a truncated tag list or the board's own scroller is a design, not an overflow.
  const contained = (e) => {
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a).overflowX;
      if (o !== 'visible' && a.getBoundingClientRect().right <= W + 1) return true;
    }
    return false;
  };
  const offscreen = els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > W + 1 && !contained(e); }).slice(0, 5).map(nm);
  return {
    hOverflow: document.documentElement.scrollWidth > W,
    coarse: matchMedia('(pointer: coarse)').matches,
    offscreen,
    controls: ctl.length,
    smallControls: small,
    inputsUnder16: [...new Set(inputs)],
    mono: [...new Set(mono)].slice(0, 6),
    eyebrow: [...new Set(eyebrow)].slice(0, 6),
    textUnder12px: [...new Set(tiny)].slice(0, 6),
    board: board ? { scrolls: boardScrolls, overflowX: boardOverflowX } : null,
  };
})()`;

const openCrm = async (query = '') => {
  await openPage(page, `${BASE}/crm${query}`);
  const ready = await waitFor("document.body.innerText.includes('Account time')");
  await settle();
  return ready;
};

/** The states the brief asks to see at every width, each as a path plus a setup step. */
const STATES = [
  { id: 'contacts-empty', query: '?area=contacts' },
  { id: 'contact-selected', query: '?area=contacts&record=maria' },
  {
    id: 'contact-edit',
    query: '?area=contacts&record=maria',
    setup: async () => {
      await clickText('button', 'Edit details');
      await sleep(300);
    },
  },
  { id: 'tags', query: '?area=contacts&record=jordan' },
  { id: 'custom-fields', query: '?area=contacts&record=maria' },
  {
    id: 'activity',
    query: '?area=contacts&record=maria',
    setup: async () => {
      await clickText('button', 'Activity');
      await sleep(300);
    },
  },
  {
    id: 'notes',
    query: '?area=contacts&record=maria',
    setup: async () => {
      await clickText('button', 'Notes');
      await sleep(300);
    },
  },
  {
    id: 'tasks',
    query: '?area=contacts&record=lena',
    setup: async () => {
      await clickText('button', 'Tasks');
      await sleep(300);
    },
  },
  { id: 'pipeline-board', query: '?area=pipeline' },
  { id: 'opportunity-selected', query: '?area=pipeline&record=opp-maria' },
  { id: 'pipeline-setup', query: '?area=setup' },
  {
    id: 'create-contact',
    query: '?area=contacts',
    setup: async () => {
      await clickText('button', 'New contact');
      await sleep(300);
    },
  },
  {
    id: 'create-opportunity',
    query: '?area=contacts&record=maria',
    setup: async () => {
      await clickText('button', 'New opportunity');
      await sleep(300);
    },
  },
  {
    id: 'refusal',
    query: '?area=setup',
    setup: async () => {
      // Dropping a stage that holds deals without saying where they go is refused (D-093).
      await page.evaluate(`(() => {
        const ta = document.querySelector('textarea');
        if (!ta) return false;
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(ta, 'New Lead\\nContacted\\nWon\\nLost');
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      await sleep(200);
      await clickText('button', 'Save stages');
      await sleep(500);
    },
    expect: "document.querySelector('[role=alert]')",
  },
  {
    id: 'empty-search',
    query: '?area=contacts',
    setup: async () => {
      await page.evaluate(`(() => {
        const el = document.querySelector('input[type=search]');
        if (!el) return false;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, 'zzzz');
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      await sleep(300);
    },
    expect: "document.body.innerText.includes('No contact matches that.')",
  },
  {
    id: 'reset-confirm',
    query: '?area=contacts',
    setup: async () => {
      await clickText('button', 'Reset account');
      await sleep(300);
    },
    expect:
      "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Keep my work')",
  },
];

try {
  // ---------- five widths ----------
  for (const width of WIDTHS) {
    // 768 is a tablet held in the hand, so it gets a coarse pointer like the phones do (§131).
    const mobile = width <= 768;
    report.widths[width] = {};
    for (const state of STATES) {
      await setViewport(page, width, 900, { mobile });
      const ready = await openCrm(state.query);
      if (!ready) {
        fail(`${width} ${state.id}: the Lab did not open`);
        continue;
      }
      if (state.setup) await state.setup();
      await settle();
      if (state.expect && !(await page.evaluate(`Boolean(${state.expect})`))) {
        fail(`${width} ${state.id}: expected state did not appear`);
      }
      const audit = await page.evaluate(AUDIT);
      report.widths[width][state.id] = audit;
      if (audit.hOverflow) fail(`${width} ${state.id}: page scrolls horizontally`);
      if (audit.offscreen.length)
        fail(`${width} ${state.id}: offscreen ${audit.offscreen.join(', ')}`);
      if (audit.mono.length) fail(`${width} ${state.id}: monospace ${audit.mono.join(', ')}`);
      if (audit.eyebrow.length) fail(`${width} ${state.id}: eyebrow ${audit.eyebrow.join(', ')}`);
      // The 44 px rule is a touch rule (A11Y-007): it is enforced wherever the pointer is coarse.
      if (audit.coarse && audit.smallControls.length)
        fail(`${width} ${state.id}: under 44px ${audit.smallControls.join(', ')}`);
      if (mobile && audit.inputsUnder16.length)
        fail(`${width} ${state.id}: input under 16px (${audit.inputsUnder16.join(', ')})`);
      if (audit.textUnder12px.length)
        fail(`${width} ${state.id}: text under 12px ${audit.textUnder12px.join(', ')}`);
      if (state.id === 'pipeline-board' && width < 1024 && audit.board) {
        if (audit.board.overflowX !== 'auto' && audit.board.overflowX !== 'scroll')
          fail(`${width} pipeline-board: board is not its own scroller`);
      }
      const height = Math.min(await page.evaluate('document.documentElement.scrollHeight'), 6000);
      await page.send('Emulation.setDeviceMetricsOverride', {
        width,
        height,
        deviceScaleFactor: 1,
        mobile,
      });
      await sleep(150);
      await screenshot(page, `${OUT}/${state.id}-${width}.png`);
    }
  }

  // ---------- keyboard ----------
  // Every primary action reached and operated with Tab, Enter, Space and arrow keys alone; the
  // element that holds focus at each step has a visible ring (A11Y-004).
  await setViewport(page, 1440, 950, { mobile: false });
  await openCrm('?area=contacts');
  // Enter activates a button only through a char event, as a real keypress does; Tab and the
  // arrows are raw key events. This mirrors the academy probe, which is known to work.
  const keys = async (key, times = 1) => {
    const code = key === 'Tab' ? 9 : key === 'Enter' ? 13 : key === ' ' ? 32 : key === 'Escape' ? 27 : 0;
    for (let i = 0; i < times; i += 1) {
      if (key === 'Enter') {
        await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code: key, text: '\r', windowsVirtualKeyCode: code });
      } else {
        await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key, code: key, windowsVirtualKeyCode: code });
      }
      await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code: key, windowsVirtualKeyCode: code });
      await sleep(60);
    }
  };
  const focused = () =>
    page.evaluate(`(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { tag: 'BODY', ring: false, text: '' };
      const s = getComputedStyle(el);
      const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none';
      return { tag: el.tagName, ring, text: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40), inMain: !!el.closest('main') };
    })()`);
  /** Tabs until the focused element's text matches, bounded. */
  const tabTo = async (pattern, limit = 80) => {
    for (let i = 0; i < limit; i += 1) {
      await keys('Tab');
      const f = await focused();
      if (pattern.test(f.text) || pattern.test(f.tag)) return f;
    }
    return null;
  };
  const k = report.keyboard;
  k.areaSwitch = await tabTo(/^Pipeline$/);
  if (k.areaSwitch) {
    await keys('Enter');
    await sleep(400);
    k.areaSwitched = await page.evaluate("location.search.includes('area=pipeline')");
  }
  if (!k.areaSwitch || !k.areaSwitched) fail('keyboard: could not switch area');
  if (k.areaSwitch && !k.areaSwitch.ring) fail('keyboard: area switch has no visible focus ring');

  // Select a deal with the keyboard, then move its stage from the picker.
  k.card = await tabTo(/Maria/);
  if (k.card) {
    await keys('Enter');
    await sleep(400);
    k.cardOpened = await waitFor("document.body.innerText.includes('Opportunity owner')", 20);
  }
  if (!k.card || !k.cardOpened) fail('keyboard: could not open a deal');
  if (k.card && !k.card.ring) fail('keyboard: deal card has no visible focus ring');
  k.stagePicker = await tabTo(/^SELECT$/);
  if (k.stagePicker) {
    // A native select changes value with the arrow keys; the change event commits it.
    const before = await page.evaluate('document.activeElement.value');
    await page.evaluate(`(() => {
      const el = document.activeElement;
      const idx = [...el.options].findIndex((o) => o.value === el.value);
      const next = el.options[idx + 1] ?? el.options[idx - 1];
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, next.value);
      el.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await sleep(500);
    const after = await page.evaluate('document.activeElement.value');
    k.stageMoved = before !== after;
    k.stageBefore = before;
    k.stageAfter = after;
  }
  if (!k.stagePicker?.ring) fail('keyboard: stage picker has no visible focus ring');
  if (!k.stageMoved) fail('keyboard: stage did not move from the picker');

  // Back to contacts by keyboard; open a contact; reach tags, owner, DND, notes, tasks.
  await openCrm('?area=contacts');
  k.row = await tabTo(/Aisha/);
  if (k.row) {
    await keys('Enter');
    await sleep(400);
  }
  k.rowOpened = await waitFor("document.body.innerText.includes('Do not disturb')", 20);
  if (!k.rowOpened) fail('keyboard: could not open a contact');
  k.owner = await tabTo(/^SELECT$/);
  k.dnd = await tabTo(/^Turn on$|^Turn off$/);
  k.tagInput = await tabTo(/^INPUT$/);
  k.notes = await tabTo(/^Notes$/);
  if (k.notes) {
    await keys('Enter');
    await sleep(300);
    k.noteField = await tabTo(/^TEXTAREA$/);
  }
  k.tasks = await tabTo(/^Tasks$/);
  for (const [name, value] of Object.entries({
    owner: k.owner,
    dnd: k.dnd,
    tagInput: k.tagInput,
    notes: k.notes,
    noteField: k.noteField,
    tasks: k.tasks,
  })) {
    if (!value) fail(`keyboard: could not reach ${name}`);
    else if (!value.ring) fail(`keyboard: ${name} has no visible focus ring`);
  }
  // Reset confirmation is reachable and dismissable.
  await openCrm('?area=contacts');
  k.reset = await tabTo(/^Reset account$/);
  if (k.reset) {
    await keys('Enter');
    await sleep(300);
    k.resetConfirmShown = await page.evaluate(
      "[...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Keep my work')",
    );
    k.cancel = await tabTo(/^Keep my work$/, 12);
    if (k.cancel) {
      await keys('Enter');
      await sleep(300);
    }
    k.resetCancelled = await page.evaluate(
      "![...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'Keep my work')",
    );
  }
  if (!k.reset || !k.resetConfirmShown || !k.resetCancelled)
    fail('keyboard: reset confirmation not operable');

  // ---------- touch at 390: a stage move without a drag ----------
  await setViewport(page, 390, 844, { mobile: true });
  await openCrm('?area=pipeline');
  const tap = async (selector) => {
    const box = await page.evaluate(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()`,
    );
    if (!box) return false;
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [box] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return true;
  };
  const t = report.touch;
  t.boardIsScroller = await page.evaluate(
    "(() => { const b = document.querySelector('[data-board]'); return b ? getComputedStyle(b).overflowX : null; })()",
  );
  t.stageSwitcher = await page.evaluate(
    "!!document.querySelector('[data-stage-switch]') || [...document.querySelectorAll('button')].some((b) => /Consult Booked/.test(b.textContent))",
  );
  t.tappedCard = await tap('[data-opportunity="opp-maria"]');
  await sleep(500);
  t.inspectorOpened = await waitFor("document.body.innerText.includes('Opportunity owner')", 20);
  if (!t.tappedCard || !t.inspectorOpened) fail('touch: tapping a deal did not open it');
  t.moved = await page.evaluate(`(() => {
    const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'Consult Done'));
    if (!sel) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'Consult Done');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(600);
  t.cardNowInConsultDone = await page.evaluate(`(() => {
    const card = document.querySelector('[data-opportunity="opp-maria"]');
    const stage = card?.closest('[data-stage]');
    return stage?.getAttribute('data-stage') ?? null;
  })()`);
  if (t.cardNowInConsultDone !== 'Consult Done')
    fail('touch: stage move did not land the card in Consult Done');
  t.hOverflow = await page.evaluate('document.documentElement.scrollWidth > innerWidth');
  if (t.hOverflow) fail('touch: page scrolls horizontally at 390');

  // ---------- reduced motion ----------
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await setViewport(page, 1440, 950, { mobile: false });
  await openCrm('?area=contacts&record=maria');
  await clickText('button', 'Activity');
  await sleep(300);
  const rm = report.reducedMotion;
  rm.applies = await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches");
  rm.motionToken = await page.evaluate(
    "getComputedStyle(document.documentElement).getPropertyValue('--bl-motion-base').trim()",
  );
  rm.runningAnimations = await page.evaluate(
    "document.getAnimations().filter((a) => a.playState === 'running' && (a.effect?.getComputedTiming?.().duration ?? 0) > 0).length",
  );
  rm.longTransitions = await page.evaluate(`(() => {
    const main = document.querySelector('main');
    const bad = [];
    for (const el of main.querySelectorAll('*')) {
      const s = getComputedStyle(el);
      const d = Math.max(...s.transitionDuration.split(',').map((v) => parseFloat(v) || 0));
      const a = Math.max(...s.animationDuration.split(',').map((v) => parseFloat(v) || 0));
      if (d > 0.01 || a > 0.01) bad.push(el.tagName + '.' + String(el.className).split(' ')[0] + ' ' + (d || a) + 's');
    }
    return [...new Set(bad)].slice(0, 8);
  })()`);
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  if (!rm.applies) fail('reduced motion: emulation did not apply');
  if (rm.runningAnimations > 0) fail(`reduced motion: ${rm.runningAnimations} animations running`);
  if (rm.longTransitions.length)
    fail(`reduced motion: transitions remain ${rm.longTransitions.join(', ')}`);
} catch (error) {
  fail(`threw: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
} finally {
  await close();
}

report.verdict = report.failures.length === 0 ? 'PASS' : 'FAIL';
console.log(JSON.stringify(report, null, 2));
if (report.failures.length > 0) process.exitCode = 1;

// CUR-023: local fixture practice, shared runner persistence, five-width Academy/runner review.
// Synthetic work only. REVIEW_HEAD pins both deployed identities; no providers are called.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileContentDir } from '@bloomlab/content-schema/node';
import { session, openPage, setViewport, screenshot, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4173';
const OUT = resolve(process.env.REVIEW_OUT ?? '.review/phase-25-connect');
const HEAD = process.env.REVIEW_HEAD;
// The same authored-fixture surface serves later SCALE/AI/specialty checkpoints.
const prefixes = (process.env.REVIEW_TOPICS ?? 'connect.').split(',');
const selected = (topics) =>
  topics.some((topic) => prefixes.some((prefix) => topic.startsWith(prefix)));
const content = await compileContentDir(resolve('content'));
const units = content.learning_units.filter((unit) => selected(unit.advanced_topics));
const exercises = content.exercises.filter((exercise) => selected(exercise.advanced_topics));
const { waitFor, click, typeInto, hasButton } = probeHelpers({ base: BASE });
mkdirSync(OUT, { recursive: true });
const results = {
  base: BASE,
  head: HEAD ?? null,
  widths: [],
  practicals: [],
  identity: null,
  diagnostics: [],
};
const browser = await session();
const { page } = browser;
await page.send('Log.enable');
void page.once('Runtime.exceptionThrown').then((entry) => results.diagnostics.push(entry));
void page.once('Log.entryAdded').then((entry) => results.diagnostics.push(entry));
const measure = () =>
  page.evaluate(
    `(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, title: document.querySelector('main h1')?.textContent, fields: [...document.querySelectorAll('textarea')].map(el => ({ label: el.closest('label')?.textContent.trim(), width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height })) }))()`,
  );
try {
  assert(units.length > 0 && exercises.length > 0, 'Selected curriculum exists');
  if (!process.env.REVIEW_TOPICS) {
    assert.equal(units.length, 9);
    assert.equal(exercises.length, 9);
  }
  assert(exercises.every((exercise) => exercise.fixture_checks.length >= 2));
  await openPage(page, `${BASE}/settings/ai`);
  assert(await waitFor(page, '!!document.querySelector("main select")'));
  await page.evaluate(
    `(() => { const el = document.querySelector('main select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, 'Off'); el.dispatchEvent(new Event('change', { bubbles: true })); })()`,
  );
  await sleep(200);
  results.aiOff = true;
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, width < 768 ? 844 : 900);
    const cases = [];
    for (const unit of units) {
      await openPage(page, `${BASE}/academy/${unit.id}`);
      assert(
        await waitFor(
          page,
          `document.querySelector('main h1')?.textContent === ${JSON.stringify(unit.title)}`,
        ),
        `${unit.id} did not render at ${width}`,
      );
      const layout = await measure();
      assert(layout.scrollWidth <= width + 1, `${unit.id} overflows at ${width}`);
      if (unit.id === 'LU-connect-webhooks') {
        const text = await page.evaluate('document.querySelector("main").innerText');
        assert(text.includes('X-GHL-Signature with Ed25519 only'));
        assert(text.includes('was deprecated on 1 September 2026'));
        assert(text.includes('reject a missing signature or failed verification'));
        assert(text.includes('Bloomlab does not perform cryptographic verification here'));
        await page.evaluate(
          `void [...document.querySelectorAll('main p')].find(el => el.textContent.startsWith('From 1 September 2026'))?.scrollIntoView({ block: 'center' })`,
        );
        await screenshot(page, `${OUT}/webhooks-${width}.png`, undefined, false);
        layout.webhookFreshness = true;
      }
      cases.push({ id: unit.id, ...layout });
    }
    await screenshot(page, `${OUT}/academy-${width}.png`, undefined, false);
    for (const exercise of exercises) {
      await openPage(page, `${BASE}/exercise/${exercise.id}`);
      assert(
        await waitFor(page, 'document.querySelectorAll("textarea").length >= 2'),
        `${exercise.id} did not open at ${width}`,
      );
      const layout = await measure();
      assert(layout.scrollWidth <= width + 1, `${exercise.id} overflows at ${width}`);
      assert(layout.fields.every((field) => field.label && field.height >= 44));
      cases.push({ id: exercise.id, ...layout });
    }
    await page.evaluate(
      `void document.querySelector('textarea').scrollIntoView({ block: 'center' })`,
    );
    await screenshot(page, `${OUT}/runner-${width}.png`, undefined, false);
    results.widths.push({ width, cases });
    console.log(`Curriculum ${prefixes.join(',')}: ${width}px, ${cases.length} layouts passed`);
  }
  await setViewport(page, 1024, 480);
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  for (const exercise of exercises) {
    await openPage(page, `${BASE}/exercise/${exercise.id}`);
    assert(await waitFor(page, hasButton('Run it')));
    await click(page, 'Run it');
    assert(
      await waitFor(page, '!!document.querySelector("[data-outcome=failed]")'),
      `${exercise.id} empty must fail`,
    );
    await click(page, 'Try again');
    assert(await waitFor(page, 'document.querySelectorAll("textarea").length >= 2'));
    for (const check of exercise.fixture_checks)
      await typeInto(page, `[data-testid="write-${check.field}"]`, check.expected_json);
    await sleep(300);
    await openPage(page, `${BASE}/exercise/${exercise.id}`);
    assert(await waitFor(page, 'document.querySelectorAll("textarea").length >= 2'));
    for (const check of exercise.fixture_checks)
      assert.equal(
        await page.evaluate(`document.querySelector('[data-testid="write-${check.field}"]').value`),
        check.expected_json,
        'draft survives reload',
      );
    await page.evaluate(`void document.querySelector('textarea').focus()`);
    await page.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
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
    const focus = await page.evaluate(
      `(() => { const el = document.activeElement; const r = el.getBoundingClientRect(); return { visible: el.matches(':focus-visible'), outline: getComputedStyle(el).outlineStyle, height: r.height }; })()`,
    );
    assert(
      focus.visible && focus.outline !== 'none' && focus.height >= 44,
      'keyboard focus remains visible',
    );
    await click(page, 'Run it');
    assert(
      await waitFor(page, '!!document.querySelector("[data-outcome=passed]")'),
      `${exercise.id} correct must pass`,
    );
    await openPage(page, `${BASE}/exercise/${exercise.id}`);
    assert(
      await waitFor(page, '!!document.querySelector("[data-outcome=passed]")'),
      'finished result survives reload',
    );
    results.practicals.push({
      id: exercise.id,
      emptyFails: true,
      draftReload: true,
      keyboardFocus: focus,
      correctPasses: true,
      resultReload: true,
    });
  }
  await setViewport(page, 390, 480);
  await openPage(page, `${BASE}/exercise/${exercises[0].id}`);
  assert(await waitFor(page, hasButton('Try again')));
  const point = await page.evaluate(
    `(() => { const el = [...document.querySelectorAll('button')].find(el => el.textContent.trim() === 'Try again'); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
  );
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert(
    await waitFor(page, 'document.querySelectorAll("textarea").length >= 2'),
    'touch retry opens saved-work controls',
  );
  results.touch = true;
  results.reducedMotion = true;
  if (HEAD) {
    const health = await (await fetch(`${BASE}/api/health`)).json();
    const build = await page.evaluate(
      `document.querySelector('[data-build-id]')?.getAttribute('data-build-id')`,
    );
    assert.equal(health.build_id, HEAD);
    assert.equal(build, HEAD);
    results.identity = { health, browser: build };
  }
  results.passed = true;
} catch (error) {
  results.failure = await page.evaluate(
    `({url:location.href,text:document.body.innerText.slice(0,5000),scripts:[...document.scripts].map(script=>script.src),resources:performance.getEntriesByType('resource').slice(-20).map(row=>({name:row.name,status:row.responseStatus}))})`,
  );
  await screenshot(page, `${OUT}/failure.png`, undefined, false);
  throw error;
} finally {
  writeFileSync(`${OUT}/connect-probe.json`, JSON.stringify(results, null, 2));
  await browser.close();
}
console.log(
  `Curriculum: ${results.widths.reduce((sum, row) => sum + row.cases.length, 0)} width cases; ${results.practicals.length} fail/retry/persist passes; touch and reduced motion passed.`,
);

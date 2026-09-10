// INF-017/CNT-010: compiled content + a real submitted attempt; no synthetic search results.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileContentDir } from '@bloomlab/content-schema/node';
import { setViewport, screenshot } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:4183';
const OUT = resolve(process.env.REVIEW_OUT ?? '.review/phase-26-search');
const HEAD = process.env.REVIEW_HEAD;
const { device, waitFor, click, typeInto } = probeHelpers({ base: BASE });
const content = await compileContentDir(resolve('content'));
const exercise = content.exercises.find((e) => e.advanced_topics.includes('connect.webhooks'));
assert(exercise, 'authored webhook practical exists');
const term = content.glossary.find((g) => g.ghl_features.length && g.related_skills.length);
mkdirSync(OUT, { recursive: true });
const browser = await device('search');
const { page } = browser;
const results = { head: HEAD ?? null, base: BASE, widths: [] };
const ready = () => waitFor(page, '!!document.querySelector("[data-global-search]")');
const resultsFor = (kind) =>
  page.evaluate(
    `[...document.querySelectorAll('[data-search-kind=${JSON.stringify(kind)}] a')].map(a => ({ text: a.textContent, href: a.getAttribute('href') }))`,
  );
const layout = async (label, width) => {
  const data = await page.evaluate(
    `({ width: innerWidth, scroll: document.documentElement.scrollWidth, title: document.querySelector('main h1')?.textContent })`,
  );
  assert(data.scroll <= width + 1, `${label} overflows at ${width}`);
  await screenshot(page, `${OUT}/${label}-${width}.png`, undefined, false);
  return { label, ...data };
};
try {
  await browser.go('/settings/ai');
  assert(await waitFor(page, '!!document.querySelector("main select")'));
  await page.evaluate(
    `(() => { const el = document.querySelector('main select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'Off'); el.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await browser.go(`/exercise/${exercise.id}`);
  assert(await waitFor(page, '!!document.querySelector("textarea")'));
  for (const check of exercise.fixture_checks)
    await typeInto(page, `[data-testid="write-${check.field}"]`, check.expected_json);
  await click(page, 'Run it');
  assert(await waitFor(page, '!!document.querySelector("[data-outcome=passed]")'));
  await browser.go('/search#kind=attempts');
  assert(await ready());
  assert(
    await waitFor(page, 'document.querySelectorAll("[data-search-kind=attempts]").length === 1'),
  );
  const attemptLink = (await resultsFor('attempts'))[0];
  assert.equal(attemptLink.text, exercise.title);
  assert(attemptLink.href.startsWith('/search#attempt='));
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 600);
    const cases = [];
    await browser.go('/search');
    assert(await ready());
    cases.push(await layout('empty', width));
    await typeInto(page, '[data-global-search]', 'workflow');
    assert(await waitFor(page, 'document.querySelectorAll("[data-search-kind]").length > 3'));
    assert.equal(
      await page.evaluate('location.search'),
      '',
      'query is never sent in the request URL',
    );
    assert((await resultsFor('skills')).length > 0);
    assert((await resultsFor('ghl-features')).length > 0);
    assert((await resultsFor('learning-units')).length > 0);
    cases.push(await layout('results', width));
    await browser.go(`/search#entry=${term.id}`);
    assert(
      await waitFor(
        page,
        `document.querySelector('main h1')?.textContent === ${JSON.stringify(term.term)}`,
      ),
    );
    assert(
      await page.evaluate(
        `document.querySelector('main').textContent.includes(${JSON.stringify(term.definition)})`,
      ),
    );
    cases.push(await layout('glossary', width));
    await browser.go('/search#entry=GHL-API-WEBHOOKS');
    assert(
      await waitFor(page, '!!document.querySelector(\'[aria-label="GHL registry guidance"]\')'),
    );
    assert(await page.evaluate('document.querySelector("main").textContent.includes("Ed25519")'));
    cases.push(await layout('feature', width));
    await browser.go(attemptLink.href);
    assert(await waitFor(page, 'document.body.textContent.includes("This is historical work")'));
    assert(
      !(await page.evaluate(
        `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Try again')`,
      )),
    );
    assert(await page.evaluate('!!document.querySelector("[data-outcome=passed]")'));
    cases.push(await layout('history', width));
    results.widths.push({ width, cases });
  }
  await browser.go('/search#kind=clients');
  assert(await ready());
  assert.equal((await resultsFor('clients')).length, content.clients.length);
  await browser.go('/search#q=zzzz-no-such-entry');
  assert(await ready());
  assert(await waitFor(page, 'document.body.textContent.includes("No matches")'));
  await setViewport(page, 1024, 480);
  await page.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'k',
    code: 'KeyK',
    windowsVirtualKeyCode: 75,
    modifiers: 2,
  });
  await page.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'k',
    code: 'KeyK',
    windowsVirtualKeyCode: 75,
  });
  assert(await page.evaluate('document.activeElement.matches("[data-global-search]")'));
  await typeInto(page, '[data-global-search]', term.term);
  assert(
    await waitFor(page, 'document.querySelectorAll("[data-search-kind=glossary]").length > 0'),
  );
  const glossaryLink = await page.evaluate(
    `(() => { const a=document.querySelector('[data-search-kind=glossary] a'); a.focus(); return a.getAttribute('href'); })()`,
  );
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
  assert(await waitFor(page, '!!document.querySelector(\'[aria-label="Glossary definition"]\')'));
  assert(
    await page.evaluate(
      'document.activeElement === document.querySelector("main h1") && document.activeElement.matches(":focus-visible")',
    ),
  );
  await click(page, 'Back to search');
  assert(await ready());
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await setViewport(page, 390, 480);
  await browser.setOffline(true);
  await typeInto(page, '[data-global-search]', 'workflow');
  assert(await waitFor(page, 'document.querySelectorAll("[data-search-kind=skills]").length > 0'));
  await page.evaluate(
    `(() => { const el=document.querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'glossary'); el.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  await typeInto(page, '[data-global-search]', term.term);
  const point = await page.evaluate(
    `(() => { const a=document.querySelector('[data-search-kind=glossary] a'); a.scrollIntoView({block:'center'}); const r=a.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`,
  );
  await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert(await waitFor(page, '!!document.querySelector(\'[aria-label="Glossary definition"]\')'));
  await page.send('Page.reload');
  assert(
    await waitFor(page, '!!document.querySelector(\'[aria-label="Glossary definition"]\')'),
    'cached glossary bookmark works offline',
  );
  await browser.setOffline(false);
  await browser.go(attemptLink.href);
  assert(await waitFor(page, '!!document.querySelector("[data-outcome=passed]")'));
  if (HEAD) {
    const health = await (await fetch(`${BASE}/api/health`)).json();
    const identity = await page.evaluate(
      "document.querySelector('[data-build-id]')?.dataset.buildId",
    );
    assert.equal(health.build_id, HEAD);
    assert.equal(identity, HEAD);
    results.identity = { worker: health.build_id, browser: identity };
  }
  results.passed =
    results.aiOff =
    results.keyboard =
    results.touch =
    results.reducedMotion =
    results.offline =
    results.bookmarks =
      true;
  results.attempt = attemptLink.href;
  results.glossary = glossaryLink;
  console.log(
    'Search: 25 width states, real saved attempt, glossary/registry, clients, keyboard/focus, short touch/reduced motion, offline bookmark reload PASS',
  );
} catch (error) {
  results.failure = await page.evaluate(
    '({ url: location.href, text: document.querySelector("main")?.innerText.slice(0,5000) })',
  );
  throw error;
} finally {
  writeFileSync(`${OUT}/search-probe.json`, JSON.stringify(results, null, 2));
  await browser.close();
}

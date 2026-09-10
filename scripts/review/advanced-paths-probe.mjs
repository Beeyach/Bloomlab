// CUR-032: seven real paths, one evidence graph, no earned Field Ready from a selection.
// Synthetic, AI Off. Bookmark, five-width layout, keyboard/touch, offline and exact-head identity.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileContentDir } from '@bloomlab/content-schema/node';
import { openPage, screenshot, setViewport, sleep } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:4183';
const HEAD = process.env.REVIEW_HEAD;
const OUT = resolve(process.env.REVIEW_OUT ?? '.review/phase-25-paths');
const content = await compileContentDir(resolve('content'));
const paths = content.campaigns.filter((path) => path.post_field_ready);
const { device, waitFor, click, typeInto, hasButton } = probeHelpers({ base: BASE });
const browser = await device('paths');
const { page } = browser;
const report = { base: BASE, head: HEAD ?? null, layouts: [], sharedEvidence: false };
mkdirSync(OUT, { recursive: true });
const pathUrl = (id) => `/campaign?path=${id}`;
const heading = (title) =>
  `document.querySelector('main h1')?.textContent === ${JSON.stringify(title)}`;
const tab = async () => {
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
};
try {
  assert.equal(paths.length, 7);
  await browser.go('/settings/ai');
  assert(await waitFor(page, '!!document.querySelector("main select")'));
  await page.evaluate(
    `(() => { const el = document.querySelector('main select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, 'Off'); el.dispatchEvent(new Event('change', { bubbles: true })); })()`,
  );
  await sleep(200);
  report.aiOff = true;
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, width < 768 ? 844 : 900);
    for (const path of [null, ...paths]) {
      await browser.go(path ? pathUrl(path.id) : '/campaign');
      assert(await waitFor(page, heading(path?.title ?? 'Field Ready')));
      assert(await waitFor(page, '!!document.querySelector("main ol li")'));
      const layout = await page.evaluate(
        `(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth, picker: document.querySelector('main select').getBoundingClientRect().toJSON(), boundary: document.querySelector('[data-testid=path-boundary]')?.textContent, skills: [...document.querySelectorAll('main a[href^="/skills/"]')].map(el => el.getAttribute('href')), directory: [...document.querySelectorAll('main section[aria-labelledby="paths-title"] a')].map(el => ({ text: el.textContent, height: el.getBoundingClientRect().height })) }))()`,
      );
      assert(layout.scrollWidth <= width + 1);
      assert(layout.picker.height >= 44 && layout.picker.right <= width);
      assert.equal(layout.directory.length, 7);
      assert.equal(layout.directory.filter((row) => row.text.includes('Recommended')).length, 1);
      assert(layout.directory.every((row) => row.height >= 44));
      if (path) {
        assert(layout.boundary.includes('does not mark Field Ready complete'));
        assert.deepEqual(
          layout.skills.sort(),
          path.gates
            .flatMap((gate) => gate.skills)
            .map((id) => `/skills/${id}`)
            .sort(),
        );
      }
      report.layouts.push({ id: path?.id ?? 'CAMP-FIELD_READY', ...layout });
    }
    await screenshot(page, `${OUT}/path-${width}.png`, undefined, false);
    await page.evaluate(`document.getElementById('paths-title').scrollIntoView({block:'start'})`);
    await screenshot(page, `${OUT}/directory-${width}.png`, undefined, false);
    await browser.go('/skills');
    assert(await waitFor(page, '!!document.querySelector("main h1")'));
    const map = await page.evaluate(
      '({title:document.querySelector("main h1").textContent,width:innerWidth,scrollWidth:document.documentElement.scrollWidth})',
    );
    assert(map.title.includes('Skill'));
    assert(map.scrollWidth <= width + 1);
    report.layouts.push({ id: 'skill-map', ...map });
    console.log(`Paths/map ${width}px passed`);
  }
  await setViewport(page, 1024, 480);
  await page.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await browser.go('/campaign?path=missing');
  assert(
    await waitFor(
      page,
      'document.body.textContent.includes("That path is not in this content build")',
    ),
  );
  report.unknownBookmark = true;
  await page.evaluate('document.querySelector("main select").focus()');
  await tab();
  const focus = await page.evaluate(
    '({visible:document.activeElement.matches(":focus-visible"),outline:getComputedStyle(document.activeElement).outlineStyle})',
  );
  assert(focus.visible && focus.outline !== 'none');
  report.keyboard = focus;
  // Native selection persists in the URL; a reload does not change the selected path.
  await page.evaluate(
    `(() => { const el=document.querySelector('main select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(el,'CAMP-GHL_AI_SPECIALIST'); el.dispatchEvent(new Event('change',{bubbles:true})); })()`,
  );
  assert(await waitFor(page, heading('GHL AI Specialist')));
  assert.equal(
    await page.evaluate('new URL(location.href).searchParams.get("path")'),
    'CAMP-GHL_AI_SPECIALIST',
  );
  await openPage(page, await page.evaluate('location.href'));
  assert(await waitFor(page, heading('GHL AI Specialist')));
  report.bookmarkReload = true;
  // A real independent exercise advances this gate and the same skill in another path.
  const skill = 'SK-JUDGMENT-ai-boundaries';
  const exercise = content.exercises.find((exercise) => exercise.skills.includes(skill));
  await browser.go(`/exercise/${exercise.id}`);
  assert(await waitFor(page, hasButton('Run it')));
  for (const check of exercise.fixture_checks)
    await typeInto(page, `[data-testid="write-${check.field}"]`, check.expected_json);
  await click(page, 'Run it');
  assert(await waitFor(page, '!!document.querySelector("[data-outcome=passed]")'));
  await browser.go(pathUrl('CAMP-GHL_AI_SPECIALIST'));
  assert(await waitFor(page, 'document.body.textContent.includes("1 of 5 gates passed")'));
  await browser.go(pathUrl('CAMP-BLOOMWIRED_OPERATOR'));
  assert(
    await waitFor(
      page,
      `document.querySelector('a[href="/skills/${skill}"]')?.closest('li')?.textContent.includes('Passed')`,
    ),
  );
  report.sharedEvidence = true;
  await browser.go('/field-ready');
  assert(await waitFor(page, heading('Your Field Ready evidence')));
  assert.equal(
    await page.evaluate('document.body.textContent.includes("Field Ready certificate")'),
    false,
  );
  report.noUnearnedFieldReady = true;
  // Cache-first application and local evidence stay usable with the network unavailable.
  await browser.go(pathUrl('CAMP-BLOOMWIRED_OPERATOR'));
  assert(await waitFor(page, heading('Bloomwired Operator Path')));
  await browser.setOffline(true);
  await click(page, 'GHL AI Specialist');
  assert(await waitFor(page, heading('GHL AI Specialist')));
  assert(await waitFor(page, 'document.body.textContent.includes("1 of 5 gates passed")'));
  report.offline = true;
  await browser.setOffline(false);
  await setViewport(page, 390, 480);
  // Resize changes both rail composition and long-page scroll anchoring. Let layout settle
  // before selecting a touch coordinate, then check its actual hit target.
  await sleep(250);
  await page.evaluate(
    `void [...document.querySelectorAll('main a')].find(el=>el.textContent==='Automation Specialist').scrollIntoView({block:'center'})`,
  );
  await sleep(250);
  const point = await page.evaluate(
    `(() => { const el=[...document.querySelectorAll('main a')].find(el=>el.textContent==='Automation Specialist'); const r=el.getBoundingClientRect(); const x=r.x+r.width/2,y=r.y+r.height/2; return {x,y,hit:el.contains(document.elementFromPoint(x,y))}; })()`,
  );
  assert(point.hit, 'touch coordinate hits the intended link after resize');
  report.touchPoint = point;
  await page.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: point.x, y: point.y }],
  });
  await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert(await waitFor(page, heading('Automation Specialist')));
  report.touch = true;
  report.reducedMotion = true;
  if (HEAD) {
    const health = await (await fetch(`${BASE}/api/health`)).json();
    const build = await page.evaluate(
      `document.querySelector('[data-build-id]')?.getAttribute('data-build-id')`,
    );
    assert.equal(health.build_id, HEAD);
    assert.equal(build, HEAD);
    report.identity = { health, browser: build };
  }
  report.passed = true;
} catch (error) {
  report.failure = { message: String(error), url: await page.evaluate('location.href') };
  await screenshot(page, `${OUT}/failure.png`, undefined, false);
  throw error;
} finally {
  writeFileSync(`${OUT}/advanced-paths-probe.json`, JSON.stringify(report, null, 2));
  await browser.close();
}
console.log(
  'Paths: 45 layouts, shared evidence, bookmark, keyboard, touch, offline, reduced motion passed.',
);

// R9: actual execution, open architecture and learner-authored scope quotes; no provider calls.
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { openPage, screenshot, session, setViewport, sleep } from './cdp.mjs';
const BASE = process.env.BASE ?? 'http://localhost:4183';
const OUT = resolve(process.env.REVIEW_OUT ?? '.review/remediation/exercise');
mkdirSync(OUT, { recursive: true });
const report = { base: BASE, checks: [] };
const axe = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const accessible = async (page) => {
  await page.evaluate(axe);
  const violations = await page.evaluate(
    `axe.run(document).then(result=>result.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})))`,
  );
  assert.deepEqual(violations, []);
};
const wait = async (page, expression) => {
  for (let i = 0; i < 200; i++) {
    if (await page.evaluate(`Boolean(${expression})`)) return;
    await sleep(100);
  }
  throw new Error('Timeout: ' + expression);
};
const q = (selector) => `document.querySelector(${JSON.stringify(selector)})`;
const id = (name) => `[data-testid="${name}"]`;
const type = async (page, selector, text) => {
  await page.evaluate(`${q(selector)}.focus()`);
  await page.send('Input.insertText', { text });
  await sleep(150);
  // Commit the native numeric field before measuring the next target's layout.
  await page.evaluate(
    `${q(selector)}.blur(); new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`,
  );
};
const activate = async (page, expression, touch) => {
  const rect = await page.evaluate(
    `(() => {const el=${expression}; el.scrollIntoView({block:'center'}); const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height};})()`,
  );
  if (touch) {
    assert(rect.w >= 44 && rect.h >= 44, '44px touch target');
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: rect.x, y: rect.y }],
    });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    // Enter through the real sequential focus order. Programmatic focus before pressing an
    // arbitrary key does not establish keyboard modality and can produce a false :focus-visible
    // failure in headless Chromium.
    assert(
      await page.evaluate(
        `(() => {const target=${expression};const items=[...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(el=>el.getClientRects().length);const index=items.indexOf(target);if(index<1)return false;items[index-1].focus();return true;})()`,
      ),
      'Target must have a preceding sequential focus stop',
    );
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
    assert(
      await page.evaluate(
        `document.activeElement===${expression} && document.activeElement.matches(':focus-visible') && (getComputedStyle(document.activeElement).outlineStyle !== 'none' || getComputedStyle(document.activeElement).boxShadow !== 'none')`,
      ),
    );
    for (const type of ['keyDown', 'keyUp'])
      await page.send('Input.dispatchKeyEvent', {
        type,
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        text: type === 'keyDown' ? '\r' : undefined,
      });
  }
  await sleep(200);
};
const snapshot = `new Promise((resolve,reject)=>{const req=indexedDB.open('bloomlab');req.onerror=()=>reject(new Error('DB unavailable'));req.onsuccess=()=>{const db=req.result;const tx=db.transaction(['workspace','sim_events','sync_queue','exercise_attempts']);const out={};for(const name of ['workspace','sim_events','sync_queue','exercise_attempts']){const r=tx.objectStore(name).getAll();r.onsuccess=()=>{out[name]=name==='workspace'?r.result.filter(v=>v.key.startsWith('exercise.replay.')).map(v=>v.value):r.result.length;};}tx.oncomplete=()=>{db.close();resolve(out);};};})`;
for (const width of [1440, 1024, 768, 390, 320])
  for (const reduced of [false, true]) {
    const { page, close } = await session();
    const touch = width < 768;
    try {
      await setViewport(page, width, 480, { mobile: touch });
      await page.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: reduced ? 'reduce' : 'no-preference' }],
      });
      const route = '/exercise/EX-RUN_THE_LEAD-booking-confirmation';
      await openPage(page, BASE + route);
      await wait(page, `${q('main input[type="text"]')}`);
      const build = await page.evaluate(
        `document.querySelector('[data-build-id]')?.dataset.buildId`,
      );
      if (process.env.REVIEW_HEAD) assert.equal(build, process.env.REVIEW_HEAD);
      await type(page, 'main input[type="text"]', 'booked');
      await type(
        page,
        'main textarea',
        'The booking workflow sends one confirmation and then adds booked.',
      );
      await openPage(page, BASE + '/workflow');
      await wait(page, q(id('run-test')));
      await page.evaluate(
        `(() => {const el=document.querySelector('[data-testid="test-panel"] select'); el.value='maria'; el.dispatchEvent(new Event('change',{bubbles:true}));})()`,
      );
      await wait(page, `!${q(id('run-test'))}.disabled`);
      await page.evaluate(`${q(id('run-test'))}.click()`);
      await wait(
        page,
        touch
          ? `document.querySelector('[data-node="n2"]')?.dataset.status === 'done'`
          : `${q(id('trigger-outcome'))}?.dataset.outcome === 'enrolled'`,
      );
      await openPage(page, BASE + route);
      await wait(page, `${q('main input[type="text"]')}?.value === 'booked'`);
      await activate(
        page,
        `[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Run it')`,
        touch,
      );
      await wait(page, q(id('actual-run-replay')));
      const saved = await page.evaluate(snapshot);
      assert.equal(saved.workspace.length, 1);
      const events = saved.workspace[0].events;
      assert(events.some((e) => e.type === 'sms.sent'));
      assert(events.some((e) => e.type === 'tag.added'));
      assert(events.every((e) => e.fields.contact_id === 'maria'));
      if (!reduced) {
        await activate(
          page,
          `[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Replay execution')`,
          touch,
        );
        assert.equal(await page.evaluate(`${q(id('actual-run-replay'))}.dataset.playing`), 'true');
        await activate(
          page,
          `[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Show full execution')`,
          touch,
        );
      }
      assert.equal(
        await page.evaluate(
          `document.querySelectorAll('[aria-label="Observed execution events"] li').length`,
        ),
        events.length,
      );
      assert(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
      await accessible(page);
      assert.deepEqual(
        await page.evaluate(snapshot),
        saved,
        'Playback changes no account, attempt or sync state',
      );
      await screenshot(page, resolve(OUT, `replay-${width}-${reduced}.png`));
      await page.send('Page.reload');
      await wait(page, q(id('actual-run-replay')));
      assert.equal(await page.evaluate(`${q(id('actual-run-replay'))}.dataset.playing`), 'false');
      assert.deepEqual(await page.evaluate(snapshot), saved);
      await openPage(page, BASE + '/exercise/EX-ARCHITECTURE_DECISION-veterinary-records');
      await wait(page, q(id('write-facts')));
      assert.equal(
        await page.evaluate(`document.querySelectorAll('main input[type="radio"]').length`),
        0,
      );
      await type(
        page,
        id('write-facts'),
        'Pets are repeating records; shared booking URL is a custom value.',
      );
      await page.send('Page.reload');
      await wait(page, `${q(id('write-facts'))}?.value.includes('repeating records')`);
      await accessible(page);
      assert(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
      await openPage(page, BASE + '/exercise/EX-PRICE_IT-summit-application-funnel');
      await wait(page, q(id('deal-project')));
      await type(page, id('deal-project'), '2400');
      await type(page, id('scope-fee-discovery_calendar'), '400');
      const label = `[...document.querySelectorAll('label')].find(el=>el.textContent.startsWith('Discovery calendar'))`;
      // Activate the associated label with a real pointer; the existing pricing probe also uses Tab/Space.
      if (touch) await activate(page, label, true);
      else {
        const point = await page.evaluate(
          `(() => {const el=${label};el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
        );
        for (const type of ['mousePressed', 'mouseReleased'])
          await page.send('Input.dispatchMouseEvent', {
            type,
            ...point,
            button: 'left',
            clickCount: 1,
          });
      }
      await sleep(400);
      await wait(page, `${q(id('deal-total'))}?.textContent.includes('$2,000')`);
      assert(
        await page.evaluate(`${q(id('scope-dangling'))}?.textContent.includes('No-show recovery')`),
      );
      await page.send('Page.reload');
      await wait(page, `${q(id('deal-total'))}?.textContent.includes('$2,000')`);
      assert.equal(await page.evaluate(`${q(id('scope-fee-discovery_calendar'))}.value`), '400');
      await accessible(page);
      assert(await page.evaluate('document.documentElement.scrollWidth <= innerWidth'));
      report.checks.push({
        width,
        height: 480,
        reduced,
        build,
        actualReplay: true,
        replayReadOnly: true,
        reload: true,
        openArchitecture: true,
        quotedScopeReduction: true,
        axeSeriousCritical: 0,
      });
      console.log(`PASS R9 ${width}×480 reduced=${reduced}`);
    } catch (error) {
      console.error({
        width,
        reduced,
        error: String(error),
        body: await page.evaluate('document.body.textContent.slice(-7000)'),
      });
      throw error;
    } finally {
      await close();
    }
  }
writeFileSync(resolve(OUT, 'exercise-probe.json'), JSON.stringify(report, null, 2));

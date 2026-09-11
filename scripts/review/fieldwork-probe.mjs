import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateSyncKey } from '../../packages/shared/src/syncKey.ts';
import { session, openPage, setViewport, screenshot } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
import { fieldworkFixtures } from './fieldwork-fixtures.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5174';
const live = process.env.FIELDWORK_LIVE === '1';
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-22-fieldwork');
mkdirSync(out, { recursive: true });
const exercise = 'EX-FIELDWORK-snapshot-no-show-system';
const path = `/exercise/${exercise}`;
const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1kAAAAASUVORK5CYII=';
const file = resolve(out, 'controlled-proof.png');
writeFileSync(file, Buffer.from(png, 'base64'));
const { page, close } = await session();
const { waitFor, typeInto } = probeHelpers({ base });
const report = {
  head: process.env.REVIEW_HEAD ?? 'working-tree',
  base,
  kind: live
    ? 'Controlled browser proof with live private Worker/D1/R2; not real-GHL acceptance'
    : 'Controlled app-origin fixtures; not real-GHL acceptance',
  widths: [],
  checks: [],
  egress: [],
  assets: [],
};
const has = (text) => `document.body.textContent.includes(${JSON.stringify(text)})`;
const wait = async (expr, label) =>
  assert(await waitFor(page, `Promise.resolve(${expr}).then(Boolean)`, 160), label ?? expr);
async function activate(label, mobile) {
  await wait(
    `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`,
  );
  // A desktop → phone recomposition can still be settling after the viewport override.
  // Scroll/focus first, then measure the final target, not a pre-layout touch coordinate.
  await page.evaluate(
    `(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}); b.scrollIntoView({block:'center'}); b.focus(); return new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); })()`,
  );
  const point = await page.evaluate(
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});const r=b.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2;return {x,y,height:r.height,hit:b.contains(document.elementFromPoint(x,y)),scale:visualViewport.scale};})()`,
  );
  if (mobile) {
    assert(
      point.height >= 44 && point.hit,
      `Visible 44px touch target: ${label} ${JSON.stringify(point)}`,
    );
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: point.x, y: point.y }],
    });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.evaluate(
      `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}); const items=[...document.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(e=>e.getClientRects().length);const i=items.indexOf(b);if(i<1)throw new Error('No preceding focus target');items[i-1].focus();})()`,
    );
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
    assert(
      await page.evaluate(
        `document.activeElement.matches(':focus-visible') && document.activeElement.textContent.trim()===${JSON.stringify(label)}`,
      ),
      'Visible keyboard focus',
    );
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
      text: '\r',
    });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter' });
  }
}
async function selectImage() {
  const { root } = await page.send('DOM.getDocument');
  const { nodeId } = await page.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: 'input[type=file]',
  });
  assert(nodeId, 'File picker remains present');
  await page.send('DOM.setFileInputFiles', { nodeId, files: [file] });
  await wait(has('ready to upload'));
}
async function selectTest(key, value) {
  await page.evaluate(
    `(()=>{const e=document.querySelector('[data-test="${key}"]');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
  );
}
async function reload() {
  await openPage(page, base + path);
  await wait(`document.querySelector('[aria-label="Fieldwork"]')`);
}
try {
  if (live) {
    const health = await (await fetch(base + '/api/health')).json();
    assert.equal(health.build_id, process.env.REVIEW_HEAD, 'Exact deployed head');
    report.health = health;
  }
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${fieldworkFixtures.toString()})(${live},${JSON.stringify(png)})`,
  });
  await openPage(page, base + path);
  await wait(`window.__fieldworkProbe && document.querySelector('[aria-label="Fieldwork"]')`);
  await wait(`window.__fieldworkProbe.rows('device').then(rows=>rows.length===1)`);
  let identity;
  if (live) {
    const r = await fetch(base + '/api/sync/link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: generateSyncKey(),
        device: { device_id: crypto.randomUUID(), label: 'Phase 22 controlled review' },
      }),
    });
    assert.equal(r.status, 200);
    identity = await r.json();
  }
  await page.evaluate(
    `(async()=>{const p=window.__fieldworkProbe;const d=(await p.rows('device'))[0],owner={...d,${identity ? `learner_id:${JSON.stringify(identity.learner_id)},session_token:${JSON.stringify(identity.session_token)}` : 'session_token:"controlled-fieldwork-session"'}};await p.put('device',owner);await p.put('workspace',{key:'ai.mode',learner_id:owner.learner_id,device_id:owner.device_id,value:'Off',updated_at:new Date().toISOString()});})()`,
  );
  const widths = [1440, 1024, 768, 390, 320];
  for (const [index, width] of widths.entries()) {
    const mobile = width < 768;
    await setViewport(page, width, 1000);
    await page.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    if (index) await activate('Try again', mobile);
    await wait(
      `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Capture proof')`,
    );
    assert.equal(
      await page.evaluate(`document.querySelectorAll('[data-proof^="reasoning."]').length`),
      0,
    );
    await screenshot(page, resolve(out, `${width}-build.png`));
    await activate('Capture proof', mobile);
    await wait(
      `document.querySelector('[data-proof="configuration.asset_inventory"]') && !document.querySelector('[data-proof="configuration.asset_inventory"]').disabled`,
    );
    for (const [key, text] of Object.entries({
      'configuration.asset_inventory':
        'Controlled proof: selected fictional workflow, calendar, form and fields.',
      'configuration.destination_values':
        'Controlled proof: inspected destination-specific values and references.',
      'explanations.portability':
        'Controlled proof: dependencies must be configured before activation.',
      'test.assets_loaded': 'Controlled proof: expected selected assets are present.',
      'test.references_checked': 'Controlled proof: destination references inspected.',
      'test.safe_draft': 'Controlled proof: workflows remain in Draft; no customer messages.',
    }))
      await typeInto(page, `[data-proof="${key}"]`, text);
    for (const key of ['assets_loaded', 'references_checked', 'safe_draft'])
      await selectTest(key, key === 'assets_loaded' ? 'failed' : 'passed');
    await wait(
      `window.__fieldworkProbe.rows('workspace').then(rows=>rows.find(r=>r.key==='exercise.attempt.${exercise}')?.value?.response?.fieldwork?.tests?.assets_loaded?.status==='failed')`,
    );
    await selectImage();
    const before = await page.evaluate(
      `window.__fieldworkProbe.rows('evidence_assets').then(rows=>rows.filter(r=>r.status==='local').map(r=>({id:r.asset_id,size:r.blob.size,type:r.blob.type})))`,
    );
    assert.equal(before.length, 1);
    assert(before[0].size > 0);
    await reload();
    await wait(has('ready to upload'));
    assert(
      await page.evaluate(
        `document.querySelector('[data-proof="configuration.asset_inventory"]').value.includes('Controlled proof')`,
      ),
    );
    assert.equal(
      await page.evaluate(`document.querySelectorAll('[data-proof^="reasoning."]').length`),
      0,
    );
    await page.evaluate(
      'window.__fieldworkProbe.failUpload=true;window.__fieldworkProbe.holdUpload=true',
    );
    await activate('Upload saved screenshot', mobile);
    await wait(has('Saving screenshot…'));
    await screenshot(page, resolve(out, `${width}-loading.png`));
    await page.evaluate('window.__fieldworkProbe.release()');
    await wait(has('Controlled offline upload'));
    await screenshot(page, resolve(out, `${width}-upload-error.png`));
    const retry = await page.evaluate(
      `window.__fieldworkProbe.rows('evidence_assets').then(rows=>rows.find(r=>r.asset_id===${JSON.stringify(before[0].id)}).blob.size)`,
    );
    assert.equal(retry, before[0].size);
    await activate('Upload saved screenshot', mobile);
    await wait(has('Private screenshot saved'));
    await activate('Delete screenshot', mobile);
    await wait(`document.querySelectorAll('input[type=file]').length===2`);
    await selectImage();
    await activate('Upload saved screenshot', mobile);
    await wait(has('Private screenshot saved'));
    await activate('Save proof checkpoint', mobile);
    await wait(has('Complete the proof first'));
    assert.equal(
      await page.evaluate(`document.querySelectorAll('[data-proof^="reasoning."]').length`),
      0,
    );
    await selectTest('assets_loaded', 'passed');
    await wait(`!document.querySelector('[role=alert]')`);
    await screenshot(page, resolve(out, `${width}-proof.png`));
    await activate('Save proof checkpoint', mobile);
    await wait(
      `document.querySelector('[data-proof="reasoning.missing_dependencies"]') && !document.querySelector('[data-proof="reasoning.missing_dependencies"]').disabled`,
    );
    await typeInto(
      page,
      '[data-proof="reasoning.missing_dependencies"]',
      'Controlled reasoning: inspect destination references and integrations before launch.',
    );
    await typeInto(
      page,
      '[data-proof="reasoning.custom_value_choice"]',
      'Controlled reasoning: one destination value avoids editing every template.',
    );
    await wait(
      `window.__fieldworkProbe.rows('workspace').then(rows=>rows.find(r=>r.key==='exercise.attempt.${exercise}')?.value.response.fieldwork.reasoning.custom_value_choice?.includes('Controlled reasoning'))`,
    );
    await reload();
    await wait(`document.querySelector('[data-proof="reasoning.custom_value_choice"]')`);
    assert(
      await page.evaluate(
        `document.querySelector('[data-proof="reasoning.custom_value_choice"]').value.includes('Controlled reasoning')`,
      ),
    );
    await page.evaluate(`document.querySelector('input[type=checkbox]').click()`);
    await screenshot(page, resolve(out, `${width}-reasoning.png`));
    await activate('Complete fieldwork', mobile);
    await wait(has('Manual proof submitted.'));
    await reload();
    await wait(has('Manual proof submitted.'));
    const rows = await page.evaluate(
      `(async()=>{const p=window.__fieldworkProbe;return {attempts:(await p.rows('exercise_attempts')).filter(r=>r.exercise_id===${JSON.stringify(exercise)}),evidence:(await p.rows('skill_evidence')).filter(r=>r.exercise_id===${JSON.stringify(exercise)}),outbox:await p.rows('sync_queue')};})()`,
    );
    assert.equal(rows.attempts.length, index + 1);
    assert.equal(rows.evidence.length, index + 1);
    assert(
      rows.evidence.every(
        (e) => e.kind === 'fieldwork' && e.real_ghl.provided && e.source.type === 'fieldwork',
      ),
    );
    assert(!JSON.stringify(rows.outbox).match(/"blob"|base64|image\/png/));
    report.assets.push(
      ...(rows.attempts.at(-1).response.fieldwork.screenshots
        ? Object.values(rows.attempts.at(-1).response.fieldwork.screenshots)
        : []),
    );
    const layout = await page.evaluate(
      `({width:innerWidth,scroll:document.documentElement.scrollWidth,inputs:[...document.querySelectorAll('textarea,select,input[type=file]')].map(e=>({width:e.getBoundingClientRect().width,font:parseFloat(getComputedStyle(e).fontSize)}))})`,
    );
    assert(layout.scroll <= width + 1, `No overflow at ${width}: ${layout.scroll}`);
    assert(layout.inputs.every((i) => i.font >= 16));
    report.widths.push({
      width,
      keyboard: !mobile,
      touch: mobile,
      overflow: false,
      attempts: rows.attempts.length,
    });
    await screenshot(page, resolve(out, `${width}-complete.png`));
    await activate('Delete screenshot', mobile);
    await wait(has('Deleted'));
    await reload();
    await wait(has('Deleted'));
    report.egress.push(...(await page.evaluate('window.__fieldworkProbe.origins')));
    console.log(
      `Fieldwork ${width}: persistence, upload retry, replace/delete, checkpoint, reasoning and completion passed`,
    );
  }
  assert(report.egress.every((origin) => origin === new URL(base).origin));
  report.checks = [
    'AI Off',
    'real IndexedDB Blob reload before upload',
    'same-Blob failed upload retry',
    'private asset metadata',
    'replace/delete and post-submit tombstone reload',
    'failed required test blocks',
    'reasoning revealed after durable proof',
    'reasoning reload',
    'idempotent attempt/evidence on reload',
    'metadata-only outbox',
    'five widths',
    'keyboard and touch',
    'loading/error states',
    'app-origin egress only',
  ];
  writeFileSync(resolve(out, 'report.json'), JSON.stringify(report, null, 2));
} catch (error) {
  await screenshot(page, resolve(out, 'failure.png'));
  writeFileSync(
    resolve(out, 'failure.json'),
    JSON.stringify(
      { message: error.message, body: await page.evaluate('document.body.innerText') },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await close();
}

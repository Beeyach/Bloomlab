import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { session, openPage, setViewport, screenshot } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
import { fieldworkFixtures } from './fieldwork-fixtures.mjs';
const base = process.env.BASE ?? 'http://127.0.0.1:5174';
const out = resolve(process.env.REVIEW_OUT ?? '.review/phase-23-portfolio');
mkdirSync(out, { recursive: true });
const downloads = resolve(out, `downloads-${Date.now()}`);
mkdirSync(downloads);
const bundle = JSON.parse(readFileSync(resolve('.content/bundle.json'), 'utf8'));
const { page, close } = await session();
const { waitFor, typeInto } = probeHelpers({ base });
const report = {
  head: process.env.REVIEW_HEAD ?? 'working-tree',
  base,
  kind: 'Controlled saved evidence in real IndexedDB; no real-GHL acceptance',
  widths: [],
  checks: [],
};
const has = (text) => `document.body.textContent.includes(${JSON.stringify(text)})`;
const wait = async (expr) =>
  assert(await waitFor(page, `Promise.resolve(${expr}).then(Boolean)`, 160), expr);
const go = async (path) => {
  await openPage(page, base + path);
  await wait('window.__fieldworkProbe');
};
async function capture(name, width) {
  assert(
    await page.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`),
    `Overflow ${name} ${width}`,
  );
  await screenshot(page, resolve(out, `${width}-${name}.png`));
}
async function activate(label, width) {
  await wait(
    `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)`,
  );
  const p = await page.evaluate(
    `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)});b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,height:r.height};})()`,
  );
  assert(p.height >= 40, `Touch target ${label} at ${width}: ${p.height}`);
  if (width < 768) {
    await page.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: p.x, y: p.y }],
    });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.evaluate(
      `(()=>{const all=[...document.querySelectorAll('a[href],button:not([disabled]),input,textarea,select,summary')].filter(e=>e.getClientRects().length);const b=all.find(b=>b.tagName==='BUTTON'&&b.textContent.trim()===${JSON.stringify(label)});all[all.indexOf(b)-1].focus()})()`,
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
        `document.activeElement.matches(':focus-visible')&&document.activeElement.textContent.trim()===${JSON.stringify(label)}`,
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
try {
  if (process.env.REVIEW_HEAD) {
    report.health = await (await fetch(base + '/api/health')).json();
    assert.equal(report.health.build_id, process.env.REVIEW_HEAD);
  }
  await page.send('Browser.setDownloadBehavior', {
    behavior: 'allowAndName',
    downloadPath: downloads,
  });
  await page.send('Page.addScriptToEvaluateOnNewDocument', {
    source: `(${fieldworkFixtures.toString()})(false,'')`,
  });
  await go('/portfolio');
  await wait(`window.__fieldworkProbe.rows('device').then(r=>r.length===1)`);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 1000);
    await wait(has('Your archive starts with the work.'));
    await capture('empty', width);
  }
  const exercises = [
    'EX-BUILD_IT-no-show-recovery',
    'EX-FIELDWORK-snapshot-no-show-system',
    'EX-WRITE_IT-summit-proposal',
  ].map((id) => bundle.exercises.find((e) => e.id === id));
  await page.evaluate(`(async()=>{
    const p=window.__fieldworkProbe,d=(await p.rows('device'))[0],at=new Date().toISOString();
    await p.put('device',{...d,session_token:'controlled-portfolio-session-secret'});
    await p.put('workspace',{key:'ai.mode',value:'Off',updated_at:at});
    const envelope=id=>({id,learner_id:d.learner_id,device_id:d.device_id,created_at:at,updated_at:at,revision:1,deleted_at:null});
    const versions={app:'0.1.0',content:${JSON.stringify(bundle.content_version)},content_hash:${JSON.stringify(bundle.content_hash)},simulator:'1',rules:'1'};
    for(const [i,e] of ${JSON.stringify(exercises)}.entries()) {
      const id=crypto.randomUUID(),screenshot=crypto.randomUUID(),deleted=crypto.randomUUID();
      const response={text:'Controlled saved learner reasoning: verify the fallback before activation.',choice:null,prediction:{},written:{}};
      if(i===1) {response.fieldwork={version:1,configuration:{inventory:'Controlled training proof'},explanations:{why:'Verify references'},tests:{inspect:{status:'passed',observed:'Controlled fixture'}},reasoning:{why:'Inspect destination values'},screenshots:{destination_workflow:screenshot,deleted_example:deleted},confirmed:true};await p.put('evidence_assets',{asset_id:deleted,attempt_id:id,exercise_id:e.id,item_key:'deleted_example',blob:null,status:'deleted',upload_started:true});}
      const common={source:{type:i===1?'fieldwork':'exercise',id:e.id},exercise_id:e.id,exercise_type:e.type,result:'passed',score:100,assistance:'independent',hints_used:[],difficulty:3,critical_failures:[],mode:'independent',versions};
      await p.put('exercise_attempts',{...envelope(id),...common,skill_ids:e.skills,started_at:at,completed_at:at,response,grade:null,...(i===0?{portfolio_capture:{version:1,workflows:[{id:'wf',name:'No-show recovery',trigger:'GHL-WF-APPOINTMENT-STATUS',nodes:[{id:'sms',type:'action',feature:'GHL-WF-SEND-SMS',label:'Invite a rebooking'}]}],funnels:[{id:'funnel',name:'Consultation booking',steps:[{id:'book',name:'Book a consultation',purpose:'booking',blocks:[{role:'calendar',connected:true}]}]}]}}:{})});
      for(const skill_id of e.skills) await p.put('skill_evidence',{...envelope(crypto.randomUUID()),...common,skill_id,kind:i===1?'fieldwork':'independent_exercise',attempt_id:id,occurred_at:at,real_ghl:i===1?{required:true,provided:true,evidence:['test:inspect']}:null});
    }
    await p.put('notes',{...envelope('portfolio-review-note'),body:'Preserved review note',target_kind:'general',target_ref:null});
  })()`);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 1000);
    await page.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    });
    await go('/portfolio');
    await wait(has('Demonstration Build'));
    await wait(has('Simulation Project'));
    await capture('populated', width);
    await go('/portfolio/PF-application-qualification-system');
    await wait(has('No passing real-GHL evidence supplied.'));
    await wait(has('No learner workflow structure'));
    await capture('missing-artifacts', width);
    await go('/portfolio/PF-consultation-booking-system');
    await wait(`document.querySelectorAll('[data-artifact]').length===10`);
    await wait(has('Manual real-GHL proof recorded at submission.'));
    await wait(has('Screenshot deleted. Historical proof remains recorded.'));
    assert(
      !(await page.evaluate('document.body.innerText')).match(
        /pp:|pa:|controlled-portfolio-session-secret/,
      ),
    );
    await capture('detail', width);
    await activate('View private screenshot', width);
    await wait(has('Screenshot unavailable.'));
    await capture('unavailable-image', width);
    await typeInto(
      page,
      '#portfolio-reflection',
      `Reflection saved at ${width}: verify the fallback.`,
    );
    await activate('Save reflection', width);
    await wait(has('Reflection saved on this device.'));
    await go('/portfolio/PF-consultation-booking-system');
    await wait(
      `document.querySelector('#portfolio-reflection')?.value.includes('saved at ${width}')`,
    );
    await go('/sync');
    await wait(has('Export Bloomlab Data'));
    await page.evaluate(
      `(()=>{const original=URL.createObjectURL;URL.createObjectURL=function(blob){URL.createObjectURL=original;throw new Error('Controlled download failure')}})()`,
    );
    await activate('Export Bloomlab Data', width);
    await wait(has('The export could not be prepared.'));
    await capture('export-error', width);
    await activate('Export Bloomlab Data', width);
    await wait(has('Export prepared.'));
    await capture('export-success', width);
    report.widths.push({
      width,
      empty: true,
      populated: true,
      tenArtifacts: true,
      missing: true,
      manualGhl: true,
      deletedAndUnavailableImage: true,
      exportSuccessAndError: true,
      reflectionReload: true,
      keyboard: width >= 768,
      touch: width < 768,
      reducedMotion: true,
      overflow: false,
    });
    console.log(
      `Portfolio ${width}: archive, ten artifacts, privacy states, reflection reload and export passed`,
    );
  }
  // Built Preview has a precached app shell; dev Vite cannot serve an offline navigation.
  if (process.env.REVIEW_HEAD || process.env.PORTFOLIO_OFFLINE === '1') {
    await go('/portfolio/PF-consultation-booking-system');
    await wait(`navigator.serviceWorker.ready.then(()=>true)`);
    await page.send('Network.emulateNetworkConditions', {
      offline: true,
      latency: 0,
      downloadThroughput: 0,
      uploadThroughput: 0,
    });
    await go('/portfolio/PF-consultation-booking-system');
    await wait(`document.querySelector('#portfolio-reflection')?.value.includes('saved at 320')`);
    await typeInto(page, '#portfolio-reflection', 'Saved while fully offline');
    await activate('Save reflection', 320);
    await wait(has('Reflection saved on this device.'));
    await go('/portfolio/PF-consultation-booking-system');
    await wait(
      `document.querySelector('#portfolio-reflection')?.value==='Saved while fully offline'`,
    );
    await go('/sync');
    await activate('Export Bloomlab Data', 320);
    await wait(has('Export prepared.'));
    await capture('offline-export', 320);
    await page.send('Network.emulateNetworkConditions', {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
    });
    report.offlineReload = true;
  }
  await wait(`window.__fieldworkProbe.rows('portfolio_projects').then(r=>r.length===2)`);
  const files = readdirSync(downloads).filter((f) => !f.endsWith('.crdownload'));
  assert(files.length >= 5, 'Actual browser downloads at all five widths');
  for (const file of files) {
    const text = readFileSync(resolve(downloads, file), 'utf8'),
      data = JSON.parse(text);
    assert.equal(data.format, 'bloomlab-data');
    assert.equal(data.schema_version, 1);
    assert.deepEqual(
      Object.keys(data)
        .filter((k) => !['format', 'schema_version', 'exported_at', 'versions'].includes(k))
        .sort(),
      ['progress', 'evidence', 'projects', 'notes', 'simulator_saves', 'portfolio_metadata'].sort(),
    );
    assert.equal(data.portfolio_metadata.portfolio_projects.length, 2);
    assert(data.notes.some((n) => n.body === 'Preserved review note'));
    assert(
      !text.match(/controlled-portfolio-session-secret|"session_token"|"blob"|base64|"object_key"/),
    );
  }
  report.downloads = files.length;
  report.egress = await page.evaluate('window.__fieldworkProbe.origins');
  assert(report.egress.every((o) => o === new URL(base).origin));
  report.checks = [
    'AI Off',
    'Canonical collection from saved attempts/evidence',
    'No private media published',
    'Actual local JSON downloads validated',
    'No provider egress',
    'No outcome claims',
    'Five widths',
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

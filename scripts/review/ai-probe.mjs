import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { openPage, session, setViewport, screenshot } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';
const base = process.env.BASE ?? 'http://localhost:4173';
const out = process.env.REVIEW_OUT ?? '.review';
mkdirSync(out, { recursive: true });
const { waitFor, click } = probeHelpers({ base });
const { page, close } = await session();
const results = [];
try {
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 900, { mobile: width < 500 });
    await openPage(page, `${base}/settings/ai`);
    await waitFor(page, "document.querySelector('h1')?.textContent==='AI settings'");
    const checks = await page.evaluate(
      `(()=>{const controls=[...document.querySelectorAll('main select,main input,main button')];return {title:document.querySelector('h1')?.textContent==='AI settings',overflow:document.documentElement.scrollWidth<=innerWidth,targets:controls.every(e=>e.getBoundingClientRect().height>=44),inputText:controls.every(e=>parseFloat(getComputedStyle(e).fontSize)>=16),modes:[...document.querySelectorAll('select option')].map(e=>e.textContent).join(',')==='Off,Limited,Full'};})()`,
    );
    await screenshot(page, `${out}/ai-settings-${width}.png`, { x: 0, y: 0, width, height: 900 });
    results.push({ width, checks });
    console.log(width, checks);
  }

  // Transport fixture for visual success only; this is not live Anthropic evidence.
  const rubricText = readFileSync('content/rubrics/SYSTEM_DESIGN_RUBRIC_V1.yaml', 'utf8');
  const rubricIds = [...rubricText.matchAll(/ {2}- id: (r[0-9]+)/g)].map((m) => m[1]);
  const answer = {
    run_id: 'visual-fixture',
    rubric_id: 'SYSTEM_DESIGN_RUBRIC_V1',
    rubric_version: 1,
    result: {
      score: 100,
      rubric_results: rubricIds.map((id) => ({
        id,
        passed: true,
        reason: 'The explanation supports this authored criterion.',
      })),
      critical_issue: null,
      strengths: ['Clear reasoning'],
      improvements: [],
      next_probe: 'How would a second location change your choice?',
      confidence: 0.9,
    },
  };
  for (const width of [1440, 1024, 768, 390, 320]) {
    await page.send('Storage.clearDataForOrigin', {
      origin: new URL(base).origin,
      storageTypes: 'indexeddb',
    });
    await setViewport(page, width, 900, { mobile: width < 500 });
    await openPage(page, `${base}/exercise/EX-ARCHITECTURE_DECISION-treatment-interest`);
    await waitFor(page, "!!document.querySelector('textarea')");
    await page.evaluate(
      "document.querySelector('input[value=contact_custom_field]').click(); document.querySelector('textarea').focus()",
    );
    await page.send('Input.insertText', {
      text: 'A contact custom field printed as a merge field.',
    });
    await click(page, 'Run it');
    const failure = await waitFor(
      page,
      "[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Retry evaluation')",
    );
    await page.send('Page.reload');
    await waitFor(page, "!!document.querySelector('textarea')");
    const recovered = await page.evaluate(
      "document.querySelector('textarea').value==='A contact custom field printed as a merge field.' && document.querySelector('textarea').disabled",
    );
    await page.evaluate("document.getElementById('submit-title').scrollIntoView({block:'center'})");
    await screenshot(page, `${out}/ai-retry-${width}.png`, undefined, false);
    await page.evaluate(
      `new Promise((resolve,reject)=>{const r=indexedDB.open('bloomlab');r.onsuccess=()=>{const db=r.result;const tx=db.transaction('device','readwrite');const table=tx.objectStore('device');const all=table.getAll();all.onsuccess=()=>{table.put({...all.result[0],session_token:'visual-fixture-only'});};tx.oncomplete=()=>{db.close();resolve(true);};tx.onerror=()=>reject(tx.error);};})`,
    );
    await page.evaluate(
      `(()=>{const real=window.fetch;window.fetch=(url,options)=>String(url).includes('/api/ai/evaluate')?Promise.resolve(new Response(${JSON.stringify(JSON.stringify(answer))},{status:200,headers:{'content-type':'application/json'}})):real(url,options);})()`,
    );
    await click(page, 'Retry evaluation');
    const passed = await waitFor(page, "document.querySelector('[data-outcome=passed]')!==null");
    const overflow = await page.evaluate('document.documentElement.scrollWidth<=innerWidth');
    await page.evaluate("document.querySelector('[data-outcome]').scrollIntoView({block:'start'})");
    await screenshot(page, `${out}/ai-result-${width}.png`, undefined, false);
    const checks = { failure, recovered, passed, overflow };
    results.push({ width, state: 'retry-and-fixture-result', checks });
    console.log(width, checks);
  }
  writeFileSync(`${out}/ai-probe.json`, JSON.stringify(results, null, 2));
  if (results.some((r) => Object.values(r.checks).some((v) => v !== true))) process.exitCode = 1;
} finally {
  await close();
}

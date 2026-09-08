// Real Worker + R2 playback only. This probe never intercepts a response with fixture audio.
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { screenshot, setViewport, openPage } from './cdp.mjs';
import { probeHelpers } from './probe-lib.mjs';

const base = process.env.BASE ?? 'http://localhost:4173';
const out = resolve(process.env.REVIEW_OUT ?? '.review');
mkdirSync(out, { recursive: true });
const helpers = probeHelpers({ base });
const { waitFor, click, selectOption, device, createKeyAndLink } = helpers;
const A = await device('Voice review');
const { page } = A;
const report = { base, widths: [], auditions: [] };
const storedDevice = `new Promise((resolve,reject)=>{const r=indexedDB.open('bloomlab');r.onsuccess=()=>{const db=r.result;const tx=db.transaction('device');const q=tx.objectStore('device').getAll();q.onsuccess=()=>{resolve(q.result[0]);db.close();};q.onerror=()=>reject(new Error('Device unavailable'));};})`;
const ready = `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Play line'&&!b.disabled)`;
async function playAndInspect(method = 'mouse') {
  assert(await waitFor(page, ready), 'Saved greeting must be available');
  await page.evaluate('performance.clearResourceTimings()');
  if (method === 'touch') {
    const point = await page.evaluate(
      `(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='Play line');b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`,
    );
    await page.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await page.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else if (method === 'keyboard') {
    await page.evaluate("document.querySelector('[data-testid=voice-line]').focus()");
    for (const label of ['Refresh library', 'Play line']) {
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
      assert.equal(await page.evaluate('document.activeElement.textContent.trim()'), label);
      assert(
        await page.evaluate(
          "document.activeElement.matches(':focus-visible') && parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0",
        ),
        'Keyboard focus must be visible',
      );
    }
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Enter',
      code: 'Enter',
      text: '\r',
      windowsVirtualKeyCode: 13,
    });
    await page.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Enter',
      code: 'Enter',
      windowsVirtualKeyCode: 13,
    });
  } else await click(page, 'Play line');
  assert(
    await waitFor(
      page,
      "document.querySelector('audio')?.readyState>=2 && document.querySelector('audio')?.duration>0",
    ),
    'Audio must actually decode in the browser',
  );
  return page.evaluate(`(async()=>{
    const audio=document.querySelector('audio');
    const response=await fetch(audio.src);
    const bytes=await response.arrayBuffer();
    const context=new AudioContext();
    const buffer=await context.decodeAudioData(bytes);
    const samples=buffer.getChannelData(0);
    let sum=0,peak=0,clipped=0;
    for(const s of samples){sum+=s*s;peak=Math.max(peak,Math.abs(s));if(Math.abs(s)>=0.999)clipped++;}
    await context.close();
    const requests=performance.getEntriesByType('resource').map(r=>r.name);
    const media=requests.filter(r=>r.includes('/api/media/voice/'));
    const directProvider=requests.some(r=>r.includes('elevenlabs'));
    const unauthorized=media.length?await fetch(media[0]).then(r=>r.status):null;
    audio.pause();
    return {duration:buffer.duration,sampleRate:buffer.sampleRate,rms:Math.sqrt(sum/samples.length),peak,clippedFraction:clipped/samples.length,
      mediaPaths:media.map(r=>new URL(r).pathname),directProvider,unauthorized,audioError:audio.error?.code??null};
  })()`);
}
try {
  const linked = await createKeyAndLink(A);
  assert(linked.linked, 'Preview session must link');
  await A.go('/system/voice');
  assert(await waitFor(page, "document.querySelector('h1')?.textContent==='Voice library'"));
  const health = await page.evaluate("fetch('/api/health').then(r=>r.json())");
  report.infrastructure =
    health.environment === 'preview'
      ? 'Live preview Worker, D1 and R2'
      : 'Local Worker, D1 and R2 emulation';
  const characters = await page.evaluate(
    "[...document.querySelector('[data-testid=voice-character]').options].map(o=>o.value)",
  );
  assert.equal(characters.length, 5);
  for (const width of [1440, 1024, 768, 390, 320]) {
    await setViewport(page, width, 900, { mobile: width < 768 });
    await openPage(page, `${base}/system/voice?character=${characters[1]}`);
    assert(await waitFor(page, ready));
    const identity = await page.evaluate(
      "document.querySelector('[data-testid=voice-identity]').textContent",
    );
    const reloaded = page.once('Page.loadEventFired');
    await page.send('Page.reload');
    await reloaded;
    assert(await waitFor(page, ready));
    const sameIdentity =
      identity ===
      (await page.evaluate("document.querySelector('[data-testid=voice-identity]').textContent"));
    const metrics =
      await page.evaluate(`(()=>{const controls=[...document.querySelectorAll('main button,main select,main a')];return {overflow:document.documentElement.scrollWidth<=innerWidth,
      targets:controls.every(e=>{const b=e.getBoundingClientRect();return b.height>=44&&b.width>=44;}),inputText:[...document.querySelectorAll('main select')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=16)};})()`);
    const method = width < 768 ? 'touch' : width === 1440 ? 'keyboard' : 'mouse';
    const playback = await playAndInspect(method);
    const checks = {
      ...metrics,
      sameIdentity,
      decoded: playback.duration > 0 && playback.rms > 0.001 && playback.audioError === null,
      private: playback.unauthorized === 401,
      providerFree: !playback.directProvider && playback.mediaPaths.length === 1,
    };
    await screenshot(page, `${out}/voice-${width}.png`);
    report.widths.push({ width, method, checks, playback });
    console.log(width, checks);
    assert(Object.values(checks).every(Boolean));
  }
  // Inspect an actual authored audition for every selected character before purchasing the library.
  for (const character of characters) {
    await selectOption(page, 'voice-character', character);
    assert(await waitFor(page, ready));
    const lines =
      process.env.VOICE_REVIEW_ALL === '1'
        ? await page.evaluate(
            "[...document.querySelector('[data-testid=voice-line]').options].map(o=>o.value)",
          )
        : [await page.evaluate("document.querySelector('[data-testid=voice-line]').value")];
    for (const line of lines) {
      await selectOption(page, 'voice-line', line);
      const playback = await playAndInspect();
      assert(playback.duration > 0 && playback.rms > 0.001 && !playback.directProvider);
      report.auditions.push({ character, line, ...playback });
      console.log(
        `${character}/${line}: decoded ${playback.duration.toFixed(2)} seconds, RMS ${playback.rms.toFixed(3)}`,
      );
    }
  }
  // Revocation is effective on the next request; authored text survives the error.
  const revoked = await page.evaluate(
    `(async()=>{const d=await ${storedDevice};return fetch('/api/sync/devices/revoke',{method:'POST',headers:{authorization:'Bearer '+d.session_token,'content-type':'application/json'},body:JSON.stringify({device_id:d.device_id})}).then(r=>r.ok);})()`,
  );
  assert(revoked);
  await click(page, 'Refresh library');
  report.revocation = await waitFor(
    page,
    "document.querySelector('[role=alert]')?.textContent.includes('revoked')",
  );
  report.textSurvives = await page.evaluate(
    "document.querySelector('[data-testid=voice-transcript]').textContent.length>0",
  );
  assert(report.revocation && report.textSurvives);
} finally {
  // Best effort cleanup on an earlier assertion failure too; never print session credentials.
  await page
    .evaluate(
      `(async()=>{const d=await ${storedDevice};if(d?.session_token)await fetch('/api/sync/devices/revoke',{method:'POST',headers:{authorization:'Bearer '+d.session_token,'content-type':'application/json'},body:JSON.stringify({device_id:d.device_id})});})()`,
    )
    .catch(() => {});
  writeFileSync(`${out}/voice-probe.json`, JSON.stringify(report, null, 2) + '\n');
  await A.close();
}

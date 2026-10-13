import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('keeps private text and URL secrets out of the actual failure-isolation report collector', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const script = `
    import assert from 'node:assert/strict';
    import {readFileSync} from 'node:fs';
    import {JSDOM} from 'jsdom';
    const source = readFileSync('./scripts/review/failure-isolation-probe.mjs', 'utf8');
    const expression = source.slice(source.indexOf('report.failureContext =')).split('\x60')[1];
    const secret = 'private-negative-control';
    const dom = new JSDOM('<p data-testid="sync-key">'+secret+'</p><div data-review-private>'+secret+'</div><button data-sync-completed="7">Sync now</button>', {
      url:'https://preview.example.test/sync?key='+secret+'#'+secret, runScripts:'outside-only'
    });
    try {
      Object.defineProperty(dom.window.document.body, 'innerText', {value:dom.window.document.body.textContent});
      dom.window.sessionStorage.setItem('__bloomlab_failed_push', '2');
      const report = await dom.window.eval(expression);
      assert.equal(JSON.stringify(report).includes(secret), false);
      assert.equal(report.url, 'https://preview.example.test/sync');
      assert.equal(report.syncCompleted, '7');
      assert.equal(report.injectedRequests.__bloomlab_failed_push, '2');
      assert.equal(report.syncButtonBusy, false);
      assert.equal(report.queueCounts, null);
      assert.equal(report.lockCounts, null);
      Object.defineProperty(dom.window, 'indexedDB', {configurable:true,value:{open:()=>{
        const request = {};
        queueMicrotask(()=>{
          request.result = {objectStoreNames:{contains:()=>true},close:()=>{},transaction:()=>({objectStore:()=>({getAll:()=>{
            const read = {result:[{status:'pending',body:secret},{status:'syncing',session_token:secret}]};
            queueMicrotask(()=>read.onsuccess());
            return read;
          }})})};
          request.onsuccess();
        });
        return request;
      }}});
      Object.defineProperty(dom.window.navigator, 'locks', {configurable:true,value:{query:async()=>({held:[{name:secret}],pending:[{name:secret}]})}});
      dom.window.document.querySelector('button').setAttribute('aria-busy','true');
      const withState = await dom.window.eval(expression);
      assert.equal(JSON.stringify(withState).includes(secret), false);
      assert.equal(withState.syncButtonBusy, true);
      assert.deepEqual(JSON.parse(JSON.stringify(withState.queueCounts)), {total:2,pending:1,syncing:1});
      assert.deepEqual(JSON.parse(JSON.stringify(withState.lockCounts)), {held:1,pending:1});
      Object.defineProperty(dom.window, 'indexedDB', {value:{open:()=>({})}});
      Object.defineProperty(dom.window.navigator, 'locks', {value:{query:()=>new Promise(()=>{})}});
      const stalled = await dom.window.eval(expression);
      assert.equal(stalled.queueCounts, null);
      assert.equal(stalled.lockCounts, null);
      assert.equal(stalled.syncButtonBusy, true);
    } finally { dom.window.close(); }
  `;
  expect(() =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      stdio: 'pipe',
      timeout: 5000,
    }),
  ).not.toThrow();
});

it('records bounded sync timings without request payloads, headers or private URL fields', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const script = `
    import assert from 'node:assert/strict';
    import {createSyncTimingCollector} from './scripts/review/sync-timing.mjs';
    const secret = 'private-negative-control';
    const timings = createSyncTimingCollector(2);
    const start = (id, path, timestamp) => timings.request({requestId:id,timestamp,request:{
      url:'https://preview.example.test'+path+'?key='+secret+'#'+secret,
      headers:{authorization:'Bearer '+secret},postData:secret
    }});
    start(secret, '/api/sync/push', 1);
    timings.response({requestId:secret,timestamp:2,response:{status:200,headers:{private:secret}}});
    timings.finish({requestId:secret,timestamp:2.5});
    start('pull', '/api/sync/pull', 3);
    timings.fail({requestId:'pull',timestamp:4,canceled:true,errorText:secret});
    start('unrelated', '/api/private/'+secret, 5);
    start('truncated', '/api/sync/push', 6);
    assert.deepEqual(timings.summary(), {
      requests:[{path:'/api/sync/push',atMs:0,status:200,responseMs:1000,totalMs:1500},
        {path:'/api/sync/pull',atMs:2000,failed:true,canceled:true,totalMs:1000}],
      omittedRequests:1
    });
    assert.equal(JSON.stringify(timings.summary()).includes(secret), false);
  `;
  expect(() =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      stdio: 'pipe',
    }),
  ).not.toThrow();
});

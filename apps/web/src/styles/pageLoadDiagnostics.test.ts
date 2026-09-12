import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('retains bounded startup failures without private payloads and isolates each navigation', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const script = `
    import assert from 'node:assert/strict';
    import {pageLoadDiagnostics} from './scripts/review/page-load-diagnostics.mjs';
    const listeners = new Map();
    let enabled = false;
    const page = {
      on: (name, listener) => { listeners.set(name, listener); return () => listeners.delete(name); },
      send: async method => { assert.equal(method, 'Network.enable'); enabled = true; }
    };
    const emit = (name, event) => listeners.get(name)?.(event);
    const diagnostics = await pageLoadDiagnostics(page, 'https://preview.example.test');
    assert.equal(enabled, true);
    const secret = 'private-fixture-value';
    emit('Network.requestWillBeSent', {requestId:'script',type:'Script',request:{url:'https://user:'+secret+'@preview.example.test/assets/main.js?key='+secret+'#'+secret,headers:{authorization:secret},postData:secret}});
    emit('Network.responseReceived', {requestId:'script',response:{status:200,fromServiceWorker:true,headers:{secret},body:secret}});
    emit('Network.loadingFailed', {requestId:'script',errorText:'net::ERR_ABORTED',canceled:true,secret});
    emit('Runtime.exceptionThrown', {exceptionDetails:{url:'https://preview.example.test/assets/main.js?'+secret,lineNumber:2,columnNumber:4,text:secret,exception:{description:secret}}});
    emit('Network.requestWillBeSent', {requestId:'api',type:'Fetch',request:{url:'https://preview.example.test/api/sync/link',postData:secret}});
    emit('Network.requestWillBeSent', {requestId:'external',type:'Script',request:{url:'https://external.test/'+secret}});
    emit('Network.loadingFailed', {requestId:'external',errorText:secret});
    const first = diagnostics.snapshot();
    assert.deepEqual(first.requests[0], {type:'Script',path:'/assets/main.js',status:200,fromServiceWorker:true,fromDiskCache:false,error:'net::ERR_ABORTED',canceled:true});
    assert.deepEqual(first.exceptions, [{path:'/assets/main.js',line:2,column:4}]);
    assert.equal(first.requests.length, 2);
    assert.equal(first.requests[1].path, '[external resource]');
    assert.equal(first.requests[1].error, '[request failed]');
    assert.equal(JSON.stringify(first).includes(secret), false);
    emit('Network.loadingFinished', {requestId:'script'});
    assert.equal(first.requests[0].finished, undefined);
    assert.equal(diagnostics.snapshot().requests[0].finished, true);
    for (let i=0; i<120; i++) {
      emit('Network.requestWillBeSent', {requestId:String(i),type:'Document',request:{url:'https://preview.example.test/'}});
      emit('Runtime.exceptionThrown', {exceptionDetails:{url:'https://preview.example.test/',lineNumber:i,columnNumber:0}});
    }
    assert.equal(diagnostics.snapshot().requests.length,100);
    assert.equal(diagnostics.snapshot().exceptions.length,20);
    diagnostics.reset();
    emit('Network.loadingFailed', {requestId:'script',errorText:'net::ERR_ABORTED'});
    assert.deepEqual(diagnostics.snapshot(), {requests:[],exceptions:[]});
    diagnostics.stop();
    assert.equal(listeners.size,0);
    await assert.rejects(pageLoadDiagnostics({...page,send:async()=>{throw new Error('enable failed')}},'https://preview.example.test'), /enable failed/);
    assert.equal(listeners.size,0);
  `;
  expect(() =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      stdio: 'pipe',
    }),
  ).not.toThrow();
});

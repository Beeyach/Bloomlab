import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('waits for the exact navigation document before reading or clearing fixture state', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const script = `
    import assert from 'node:assert/strict';
    import {navigateDocument,openPage,resetIndexedDbFixture} from './scripts/review/cdp.mjs';
    const flush=()=>new Promise(resolve=>setImmediate(resolve));
    function fixture(result={frameId:'main',loaderId:'new'}, beforeReply=()=>{}) {
      const listeners=new Map(), actions=[];
      const emit=(loaderId,frameId='main',name='load')=>listeners.get('Page.lifecycleEvent')?.({loaderId,frameId,name});
      const page={
        on(method,callback){listeners.set(method,callback);return ()=>listeners.delete(method)},
        once(method){return new Promise(resolve=>listeners.set(method,resolve))},
        async send(method,params){
          actions.push(method);
          if(method==='Page.navigate'){
            // Old driver's global listener accepts this unrelated document's queued load.
            listeners.get('Page.loadEventFired')?.({timestamp:1});
            emit('old');beforeReply(emit);return result;
          }
          return {};
        },
        async evaluate(){actions.push('evaluate');return true}
      };
      return {page,emit,actions,listeners};
    }
    for(const operation of [openPage,resetIndexedDbFixture]) {
      const f=fixture();let done=false;
      const pending=operation(f.page,'https://fixture.test/skills').then(()=>{done=true});
      await flush();
      assert.equal(done,false,'must not finish on the old document load');
      assert.equal(f.actions.includes('evaluate'),false,'must not read the old document');
      assert.equal(f.actions.includes('Storage.clearDataForOrigin'),false,'must not clear an active fixture');
      f.emit('new','child');f.emit('new','main','DOMContentLoaded');await flush();
      assert.equal(done,false,'wrong frame or early lifecycle must not complete navigation');
      f.emit('new');await pending;
      assert.equal(f.listeners.size,0);
    }
    // Fast loads can precede the navigation reply; neither miss them nor leak a listener.
    const early=fixture(undefined,emit=>emit('new'));await navigateDocument(early.page,'https://fixture.test');assert.equal(early.listeners.size,0);
    const fragment=fixture({frameId:'main'});await navigateDocument(fragment.page,'https://fixture.test/#detail');assert.equal(fragment.listeners.size,0);
    const failed=fixture({errorText:'net::ERR_FAILED'});await assert.rejects(navigateDocument(failed.page,'https://fixture.test'),/Navigation failed/);assert.equal(failed.listeners.size,0);
    const rejected=fixture();rejected.page.send=async method=>{if(method==='Page.navigate')throw Error('protocol failure');return {}};
    await assert.rejects(navigateDocument(rejected.page,'https://fixture.test'),/protocol failure/);assert.equal(rejected.listeners.size,0);
    const realSetTimeout=globalThis.setTimeout;let expire;
    globalThis.setTimeout=(callback,ms)=>{assert.equal(ms,30000);expire=callback;return 0};
    const timeout=fixture();const pending=assert.rejects(navigateDocument(timeout.page,'https://fixture.test'),/Page load timed out/);
    await flush();expire();await pending;globalThis.setTimeout=realSetTimeout;assert.equal(timeout.listeners.size,0);
  `;
  expect(() =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      stdio: 'pipe',
      timeout: 10000,
    }),
  ).not.toThrow();
});

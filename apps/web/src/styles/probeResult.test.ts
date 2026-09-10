import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('fails sync review for caught errors, false or missing verdicts, never just successful cleanup', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const script = `import assert from 'node:assert/strict';
    import {probeExitCode} from './scripts/review/probe-result.mjs';
    assert.equal(probeExitCode({ok:true}),0);
    for(const report of [undefined,{}, {ok:false}, {error:'controlled'}, {ok:true,error:'controlled'}])
      assert.equal(probeExitCode(report),1);`;
  expect(() =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      stdio: 'pipe',
    }),
  ).not.toThrow();
});

it('requires the saved note and exact outbox payload, independent of other pending entities', () => {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
  const script = `import assert from 'node:assert/strict';
    import {noteOutboxEvidence} from './scripts/review/note-outbox-evidence.mjs';
    const note={id:'note-a',body:'saved offline',revision:1,deleted_at:null};
    const op={entity:'notes',entity_id:note.id,op:'upsert',revision:1,payload:{...note}};
    const unrelated={...op,entity:'campaign_progress'};
    assert.deepEqual(noteOutboxEvidence([note],[unrelated,op]),{savedLocally:true,queuedBeforeSync:true,queueCount:2});
    for(const queue of [[],[unrelated],[{...op,entity_id:'other'}],[{...op,revision:2}],[{...op,payload:{...note,revision:2}}],[{...op,payload:{...note,body:'stale'}}],[{...op,payload:{...note,deleted_at:'2026-09-10'}}],[{...op,op:'delete'}]])
      assert.equal(noteOutboxEvidence([note],queue).queuedBeforeSync,false);
    assert.equal(noteOutboxEvidence([], [op]).queuedBeforeSync,false);
    assert.equal(noteOutboxEvidence([{...note,deleted_at:'2026-09-10'}], [op]).queuedBeforeSync,false);`;
  expect(() =>
    execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
      stdio: 'pipe',
    }),
  ).not.toThrow();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createInfinityRecoveryChecks,INFINITY_RECOVERY} from '../src/checks/infinity-recovery.js';
import {createMonitor} from '../src/index.js';
test('observer exposes a recovery record and never certifies an empty set of checks',async()=>{
 const m=createMonitor(),r=await m.fetch(new Request('https://test/p/observer/recovery')),body=await r.json();assert.equal(body.recoveries[0].workingCommit,INFINITY_RECOVERY.workingCommit);
 const run=await (await m.fetch(new Request('https://test/p/observer/run'))).json();assert.equal(run.ok,false);assert.equal(run.configured,false);
});
test('recovery contracts identify missing safeguards',async()=>{
 const checks=createInfinityRecoveryChecks({fetchImpl:async()=>new Response('old runtime')});const result=await checks[0].run();assert.equal(result.ok,false);assert.ok(result.missing.includes('cachedCountInputs'));assert.equal(result.recoveryId,INFINITY_RECOVERY.id);
});

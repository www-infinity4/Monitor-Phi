import test from 'node:test';import assert from 'node:assert/strict';
import {createOracleSystemChecks,ORACLE_SURFACES} from '../src/checks/oracle-system.js';
test('cross-repository monitor contains Oracle reader, Purple, Radio and Omni contracts',()=>{
 assert.ok(ORACLE_SURFACES.length>=8);
 assert.ok(ORACLE_SURFACES.find(x=>x.name==='scholastic-reader').forbidden.includes('phi-scholastic-reader.webp'));
 assert.ok(ORACLE_SURFACES.some(x=>x.name==='radio-unified-bridge'));
 assert.ok(ORACLE_SURFACES.some(x=>x.name==='quant-state-auth-guard'&&x.authorizationRequired));
});
test('reader contract detects broken controls and original forbidden book image',async()=>{
 const surfaces=[{name:'reader',repository:'test',url:'https://example.test/card',markers:['scopedTerm(','qdata-comparison-table'],forbidden:['old-book.png']}];
 const [check]=createOracleSystemChecks({surfaces,fetchImpl:async()=>new Response('scopedTerm( old-book.png',{status:200})});
 const data=await check.run();
 assert.equal(data.ok,false);assert.deepEqual(data.missing,['qdata-comparison-table']);assert.deepEqual(data.forbidden,['old-book.png']);
});
test('unauthenticated Music Quant endpoint must reject guest; never attaches a wallet token',async()=>{
 let options;
 const [check]=createOracleSystemChecks({surfaces:[{name:'ledger',repository:'test',url:'https://example.test/state',authorizationRequired:true}],fetchImpl:async(_,o)=>{options=o;return new Response('Unauthorized',{status:401})}});
 assert.equal((await check.run()).ok,true);assert.ok(!options.headers.authorization);
 const [broken]=createOracleSystemChecks({surfaces:[{name:'ledger',repository:'test',url:'https://example.test/state',authorizationRequired:true}],fetchImpl:async()=>new Response('OK',{status:200})});
 assert.equal((await broken.run()).reason,'authorization_bypass_possible');
});

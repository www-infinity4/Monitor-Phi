import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const {createInfinityRecoveryChecks}=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync('src/checks/infinity-recovery.js','utf8')).toString('base64'));
test('observer detects the org AI rejection and incorrect allowed request headers',async()=>{
 let mode='blocked';const checks=createInfinityRecoveryChecks({fetchImpl:async()=>new Response(null,{status:mode==='blocked'?403:204,headers:{'Access-Control-Allow-Origin':'https://quantaphi.org','Access-Control-Allow-Headers':mode==='wrong'?'accept':'content-type'}})});
 const ai=checks.find(x=>x.name==='suite-ai-org');assert.equal((await ai.run()).ok,false);mode='wrong';assert.equal((await ai.run()).ok,false);mode='valid';assert.equal((await ai.run()).ok,true);
});
test('observer catches an Omni page whose relative script resolves outside its app',async()=>{
 let fixed=false;const fetchImpl=async(url)=>{
  if(url==='https://quantaphi.org/overview/') {const r=new Response('<script src="../assets/app.js"></script>',{headers:{'Content-Type':'text/html'}});Object.defineProperty(r,'url',{value:fixed?'https://quantaphi.org/omni-phi/overview/':url});return r}
  return new Response('window.OmniPhi={}',{status:url.includes('/omni-phi/assets/')?200:404,headers:{'Content-Type':'application/javascript'}});
 };
 const check=createInfinityRecoveryChecks({fetchImpl}).find(x=>x.name==='suite-omni-overview-assets');assert.equal((await check.run()).ok,false);fixed=true;assert.equal((await check.run()).ok,true);
});

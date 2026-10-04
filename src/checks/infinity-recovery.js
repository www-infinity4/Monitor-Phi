export const INFINITY_RECOVERY = Object.freeze({
  id: 'infinity-saved-history-2026-10-04',
  workingCommit: '3e6196b4363d0269a8ed02626d5c2116eab7de5a',
  baselineCommit: 'b410a5ccbe53fff849c5568dc123847d4b60436b',
  repository: 'https://github.com/www-infinity4/C13b0',
  runbook: 'https://github.com/www-infinity4/Monitor-Phi/blob/main/docs/INFINITY_RECOVERY_2026-10-04.md',
  mode: 'observe-only',
  preserve: ['wallet identity','balances','token ownership','saved history','v1 storage envelopes','cloud synchronization'],
  steps: ['Check deployed wallet and counter cache contracts.','Compare the failing code with the working commit before editing.','Restore ledger decode caching and count invalidation, including account changes.','Retain bounded Unicode encoding and avoid redundant durable mirror writes.','Defer hidden builds until idle; release them on pointer, key and focus activity.','Run storage and wallet tests, then verify search, selection, wallet and News navigation at 412px.','Deploy through the existing Pages workflow; never clear browser storage as a repair.'],
  evidence: {sampleRecords:230,encodedBytesApprox:1970000,beforeWalletReadMs:[408,262,260,230],afterWalletReadMs:[20,0,0,0],storageWalletTests:17},
  limitations: 'Static deployment checks detect missing safeguards. They do not prove responsiveness on every device or restore code automatically.'
});
const BASE='https://quantaphi.org/infinity-phi/';
export function createInfinityRecoveryChecks({fetchImpl=globalThis.fetch,timeoutMs=8000,includePreflights=false}={}) {
  const sourceChecks=[
    ['infinity-saved-ledger-cache','wallet-runtime.js',['cachedCountInputs','cachedLedgerRaw','inputs.every','canonicalSearchCounts']],
    ['infinity-token-ledger-cache','unified-token-count.js',['cachedLedgerRaw','raw===cachedLedgerRaw','reconcile']],
    ['infinity-idle-builder','infinity-starcoin-contract.js',['20261004-history2']],
    ['omni-education-builder','../omni-phi/code/education-builder.js',['CodePhiEducation','sourceIds','packageFiles','Human review pending']],
    ['news-current-feed','../news-phi/monitor-refresh-loop.js',["indexed-fresh-news-v5","categories:'news'","c.publicationVerified","canonicalUrl","windowDays:7","for(const page of [2,3])"]]
  ].map(([name,path,required])=>({name,async run(){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);try{const url=new URL(path,BASE).href,r=await fetchImpl(url,{cache:'no-store',signal:ctl.signal}),body=await r.text(),missing=required.filter(x=>!body.includes(x));return {ok:r.ok&&!missing.length,url,status:r.status,missing,recoveryId:INFINITY_RECOVERY.id,runbook:INFINITY_RECOVERY.runbook,limitation:'Source markers only; mobile behavior requires the runbook checks.'}}finally{clearTimeout(timer)}}}));
  const preflights=[
    ['suite-ai-org','https://infinity-rogers.marvaseater.workers.dev/v1/chat','content-type'],
    ['suite-news-monitor','https://monitor-phi.marvaseater.workers.dev/p/news/feed','content-type'],
    ['suite-unified-wallet','https://unified-wallet.marvaseater.workers.dev/v1/wallet/state','authorization,content-type'],
    ['suite-quant-ledger','https://quanta-phi-ledger.marvaseater.workers.dev/v1/quants/search','authorization,content-type']
  ].map(([name,url,requested])=>({name,async run(){
    const response=await fetchImpl(url,{method:'OPTIONS',headers:{Origin:'https://quantaphi.org','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':requested},signal:AbortSignal.timeout(timeoutMs)});
    const origin=response.headers.get('Access-Control-Allow-Origin'),allowed=(response.headers.get('Access-Control-Allow-Headers')||'').toLowerCase().split(',').map(x=>x.trim());
    return {ok:response.ok&&(origin==='*'||origin==='https://quantaphi.org')&&requested.split(',').every(x=>allowed.includes(x)),url,status:response.status,limitation:'Connection check only; no user credentials or ledger writes.'};
  }}));
  const pages=[['suite-infinity-assets','https://quantaphi.org/infinity-phi/'],['suite-omni-overview-assets','https://quantaphi.org/overview/']].map(([name,url])=>({name,async run(){
    const page=await fetchImpl(url,{cache:'no-store',signal:AbortSignal.timeout(timeoutMs)}),html=await page.text(),base=page.url||url;
    const refs=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(x=>new URL(x[1],base).href).filter(x=>new URL(x).origin==='https://quantaphi.org');
    const chunks=[...html.matchAll(/\/infinity-phi\/_next\/static\/chunks\/[a-zA-Z0-9_-]+\.js/g)].map(x=>'https://quantaphi.org'+x[0]);
    const assets=[...new Set([...refs,...chunks])];
    const results=await Promise.all(assets.map(async asset=>{try{const r=await fetchImpl(asset,{cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});return {url:asset,ok:r.ok&&/javascript/.test(r.headers.get('Content-Type')||''),status:r.status}}catch(error){return {url:asset,ok:false,error:String(error?.message||error)}}}));
    return {ok:page.ok&&results.length>0&&results.every(x=>x.ok),url:base,status:page.status,assets:results,limitation:'Checks served scripts and chunk URLs; does not certify device responsiveness.'};
  }}));
  // Workers.dev OPTIONS subrequests return platform 404s from this Worker.
  // Run preflights from a browser/external runner; do not label that limitation an app outage.
  return [...sourceChecks,...(includePreflights?preflights:[]),...pages];
}

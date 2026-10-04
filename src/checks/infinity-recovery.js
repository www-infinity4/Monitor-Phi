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
const BASE='https://www-infinity4.github.io/C13b0/';
export function createInfinityRecoveryChecks({fetchImpl=globalThis.fetch,timeoutMs=8000}={}) {
  return [
    ['infinity-saved-ledger-cache','wallet-runtime.js',['cachedCountInputs','cachedLedgerRaw','inputs.every','canonicalSearchCounts']],
    ['infinity-token-ledger-cache','unified-token-count.js',['cachedLedgerRaw','raw===cachedLedgerRaw','reconcile']],
    ['infinity-idle-builder','infinity-starcoin-contract.js',['20261004-history2']],
    ['omni-education-builder','../Omni-Phi/code/education-builder.js',['CodePhiEducation','sourceIds','packageFiles','Human review pending']],
    ['news-current-feed','../News-Phi/monitor-refresh-loop.js',["indexed-fresh-news-v4","categories:'news'","windowDays:7","for(const page of [2,3])"]]
  ].map(([name,path,required])=>({name,async run(){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);try{const url=new URL(path,BASE).href,r=await fetchImpl(url,{cache:'no-store',signal:ctl.signal}),body=await r.text(),missing=required.filter(x=>!body.includes(x));return {ok:r.ok&&!missing.length,url,status:r.status,missing,recoveryId:INFINITY_RECOVERY.id,runbook:INFINITY_RECOVERY.runbook,limitation:'Source markers only; mobile behavior requires the runbook checks.'}}finally{clearTimeout(timer)}}}));
}

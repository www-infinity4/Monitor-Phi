// Monitor Phi: read-only cross-site Oracle and Music Quant invariants.
// This detects removed buttons, stale scripts and broken owner scope, without
// opening wallets, clicking paid controls or generating any credits.
export const ORACLE_SURFACES=[
 {name:'scholastic-reader',repository:'www-infinity4/QuantaPhi',url:'https://quantaphi.org/phi-scholastic-data.js',
  markers:['selectionQueries(','scopedTerm(','qdata-comparison-table','sourceQuery:x.query','qreader-text-only'],forbidden:['phi-scholastic-reader.webp']},
 {name:'oracle-reader-style',repository:'www-infinity4/QuantaPhi',url:'https://quantaphi.org/phi-scholastic-data.css',
  markers:['qreader-text-only','qdata-comparison-table','min-height:44px']},
 {name:'purple-assimilation',repository:'www-infinity4/QuantaPhi',url:'https://quantaphi.org/phi-assimilation.js',
  markers:['const qs=terms(q),qc=cats(q)','x.overlap>0','No relevant earlier Quants']},
 {name:'quanta-music-recovery',repository:'www-infinity4/QuantaPhi',url:'https://quantaphi.org/music-quant-cloud.js',
  markers:['fetchCompleteMusicHistory','music_quant_history_incomplete','music_quant_wallet_changed_during_sync']},
 {name:'radio-music-recovery',repository:'www-infinity4/Alien-Radio',url:'https://www-infinity4.github.io/Alien-Radio/music-quant-cloud.js',
  markers:['fetchCompleteMusicHistory','music_quant_history_incomplete','music_quant_wallet_changed_during_sync','MusicQuantStore.putMany']},
 {name:'radio-unified-bridge',repository:'www-infinity4/Alien-Radio',url:'https://www-infinity4.github.io/Alien-Radio/unified-wallet-bridge.js',
  markers:['musicquant:cloud-synced','lastReconciled','if(connected&&wallet)await mintChanged']},
 {name:'omni-music-recovery',repository:'www-infinity4/Omni-Phi',url:'https://www-infinity4.github.io/Omni-Phi/music-quant-cloud.js',
  markers:['fetchCompleteMusicHistory','music_quant_history_incomplete','music_quant_wallet_changed_during_sync']},
 {name:'quant-state-auth-guard',repository:'www-infinity4/QuantaPhi',url:'https://quanta-phi-ledger.marvaseater.workers.dev/v1/music-quants/state',authorizationRequired:true}
];
export function createOracleSystemChecks({fetchImpl=globalThis.fetch,surfaces=ORACLE_SURFACES,timeoutMs=10000}={}){
 return surfaces.map(s=>({name:'oracle:'+s.name,async run(){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
   // Never attach an account token. Protected endpoints must reject this caller.
   const response=await fetchImpl(s.url,{method:'GET',cache:'no-store',redirect:'follow',signal:controller.signal,headers:{accept:'text/html,text/plain,application/javascript,application/json'}});
   if(s.authorizationRequired){const ok=[401,403].includes(response.status);return {ok,repository:s.repository,url:s.url,status:response.status,reason:ok?'auth_enforced':'authorization_bypass_possible'};}
   const text=(await response.text()).slice(0,250000);
   const missing=(s.markers||[]).filter(m=>!text.includes(m)),forbidden=(s.forbidden||[]).filter(m=>text.includes(m));
   const ok=response.ok&&!missing.length&&!forbidden.length;
   return {ok,repository:s.repository,url:s.url,status:response.status,missing,forbidden,reason:ok?'verified':'oracle_contract_mismatch'};
  }catch(error){return {ok:false,repository:s.repository,url:s.url,reason:'unavailable',error:String(error?.message||error).slice(0,160)}}
  finally{clearTimeout(timer)}
 }}));
}

const SITES=['/','/infinity-phi/','/omni-phi/','/news-phi/','/web-phi/','/builder-reserve/','/infinity-radio/','/omni-tv/','/alien-coin/','/bitcoin-crusher/','/oracle-octaves/','/mckee-coins/','/shoplc/'];
const CONTRACTS=[
 ['shared-wallet','https://quantaphi.org/Control-Phi/control-phi.js',['refreshStarCoinCloud','wallet_identity_mismatch','infinity-wallet-button','refreshWalletOnOpen']],
 ['buy-item-reward','https://quantaphi.org/shoplc/app.js',['/v1/shoplc/rewards','shoplc:pending-reward-receipts:v1','...intent','flushRewardQueue']],
 ['quanta-wallet','https://quantaphi.org/wallet-runtime.js',['refreshStarCoinCloud','refreshWalletOnOpen']],
 ['story-and-image','https://quantaphi.org/',['Reads','robotDirections']],
 ['ledger-policy','https://starquest-ledger.marvaseater.workers.dev/health',['"rewardAmount":5','"dailyLimit":3','America/Chicago']]
];
async function read(url){const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});const body=await r.text();return {status:r.status,body};}
async function scan(env){
 const lease=await env.DB.prepare('UPDATE observer_lock SET until_at=? WHERE id=1 AND until_at<?').bind(Date.now()+180000,Date.now()).run();
 if(!lease.meta.changes)return {ok:false,reason:'scan_already_running'};
 const runId=crypto.randomUUID(),at=Date.now(),results=[];
 try{
  let registry=[];try{const r=await read('https://quantaphi.org/Control-Phi/channels.json');registry=JSON.parse(r.body).channels||[]}catch(e){results.push({name:'channel-registry',ok:false,error:e.message})}
  const jobs=[...new Set([...SITES,...registry.map(x=>'/'+x.path+'/')])].map(path=>async()=>{
   const r=await read('https://quantaphi.org'+path);const plain=r.body.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').trim();return {name:'page:'+path,path,ok:r.status===200&&plain.length>80&&!/Page not found · GitHub Pages|File not found/.test(r.body),status:r.status,title:r.body.match(/<title[^>]*>([^<]*)/i)?.[1]||'',verification:'HTTP/readable source only; browser and playback evidence separate'};
  });
  for(const [name,url,markers] of CONTRACTS)jobs.push(async()=>{const r=await read(url),missing=markers.filter(m=>!r.body.includes(m));return {name,url,ok:r.status===200&&!missing.length,status:r.status,missing,verification:'Published contract markers; no reward transactions executed'}});
  let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<jobs.length){const job=jobs[next++];try{results.push(await job())}catch(e){results.push({name:'request:'+next,ok:false,error:e.message})}}}));
  const ok=results.every(x=>x.ok),json=JSON.stringify(results);
  await env.DB.prepare('INSERT INTO observer_runs(id,created_at,ok,results_json) VALUES(?,?,?,?)').bind(runId,at,ok?1:0,json).run();
  await env.DB.batch(results.map(r=>r.ok?env.DB.prepare("UPDATE repair_tickets SET status='recovered',last_seen=? WHERE check_name=? AND status='open'").bind(at,r.name):env.DB.prepare("INSERT INTO repair_tickets(check_name,status,first_seen,last_seen,evidence_json) VALUES(?,'open',?,?,?) ON CONFLICT(check_name) DO UPDATE SET status='open',last_seen=excluded.last_seen,evidence_json=excluded.evidence_json").bind(r.name,at,at,JSON.stringify(r))));
  return {ok,runId,checked:results.length,failures:results.filter(x=>!x.ok)};
 }finally{await env.DB.prepare('UPDATE observer_lock SET until_at=0 WHERE id=1').run()}
}
export default {
 async scheduled(event,env,ctx){ctx.waitUntil(scan(env))},
 async fetch(request,env){const path=new URL(request.url).pathname;const headers={'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'};
  if(path==='/health')return Response.json({ok:true,service:'infinity-suite-observer',intervalMinutes:15,mode:'observe-and-ticket',automaticRepairs:false},{headers});
  if(path==='/run'&&request.method==='POST'){if(request.headers.get('Authorization')!=='Bearer '+env.RUN_TOKEN)return Response.json({ok:false},{status:401});return Response.json(await scan(env),{headers})}
  if(path==='/status'){const run=await env.DB.prepare('SELECT * FROM observer_runs ORDER BY created_at DESC LIMIT 1').first();const tickets=await env.DB.prepare("SELECT check_name,status,first_seen,last_seen,evidence_json FROM repair_tickets WHERE status='open'").all();return Response.json({ok:true,run:run?{...run,results:JSON.parse(run.results_json),results_json:undefined}:null,repairTickets:tickets.results},{headers})}
  return Response.json({ok:false,error:'not_found'},{status:404,headers});
 }
};

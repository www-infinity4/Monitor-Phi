import fs from 'node:fs/promises';
import {createOracleSystemChecks} from '../src/checks/oracle-system.js';
const findings=await Promise.all(createOracleSystemChecks().map(async check=>({name:check.name,...await check.run()})));
const failures=findings.filter(x=>!x.ok);
const report={checkedAt:new Date().toISOString(),checked:findings.length,passed:findings.length-failures.length,failures,results:findings};
await fs.mkdir('monitor-receipts',{recursive:true});await fs.writeFile('monitor-receipts/oracle-system.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({checkedAt:report.checkedAt,checked:report.checked,passed:report.passed,failures},null,2));
if(failures.length&&process.env.ORACLE_OPEN_ISSUES==='true'&&process.env.GITHUB_TOKEN){
 const repo=process.env.GITHUB_REPOSITORY;
 if(repo!=='www-infinity4/Monitor-Phi')throw Error('Unexpected watch host');
 const base='https://api.github.com/repos/'+repo+'/issues';
 const h={Accept:'application/vnd.github+json',Authorization:'Bearer '+process.env.GITHUB_TOKEN,'Content-Type':'application/json'};
 const r=await fetch(base+'?state=open&per_page=100',{headers:h,signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('Incident lookup unavailable '+r.status);
 const title='[Agent Job] Oracle cross-site wallet and research repair';
 const prev=(await r.json()).find(issue=>issue.title===title&&!issue.pull_request);
 const body=['Daily Monitor-Phi Oracle contract audit',report.checkedAt,'',...failures.map(f=>'- '+f.name+' ('+f.repository+'): '+f.reason+' HTTP '+(f.status||'unavailable')+'; missing '+(f.missing||[]).join(', ')+'; forbidden '+(f.forbidden||[]).join(', ')),'','Next bot action: inspect the pinned repository and deployed asset, reproduce each failure, then submit the smallest verified PR. Never mint wallet assets, alter account identity, reset records, or deploy on the basis of a keyword mismatch alone.'].join('\n');
 const url=prev?base+'/'+prev.number+'/comments':base;
 const result=await fetch(url,{method:'POST',headers:h,body:JSON.stringify(prev?{body}:{title,body}),signal:AbortSignal.timeout(10000)});
 if(!result.ok)throw Error('Incident publish failed '+result.status);
}
if(failures.length)process.exitCode=1;

const clean=value=>String(value??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
export function newsPublication(item,now=Date.now()){
  const date=Date.parse(item.publishedDate||item.published_at||item.pubDate||item.date||'');
  if(Number.isFinite(date)&&date<=now+300000)return date;
  const relative=clean(item.metadata).match(/(\d+)\s+(minute|hour|day|week)s?\s+ago/i);
  if(relative)return now-Number(relative[1])*{minute:60000,hour:3600000,day:86400000,week:604800000}[relative[2].toLowerCase()];
  if(/just now/i.test(clean(item.metadata)))return now;
  return 0;
}
export function createSearxngNewsProvider({endpoint,fetchImpl=fetch,perSeed=8,timeoutMs=15000}={}){
  const base=clean(endpoint).replace(/\/$/,'');if(!base)throw TypeError('SearXNG endpoint is required');
  return async function({seeds}){
    const now=Date.now();
    const batches=await Promise.allSettled(seeds.slice(0,12).map(async seed=>{
      const result=await Promise.allSettled(['day','week'].map(async range=>{
        const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeoutMs);
        try{
          const params=new URLSearchParams({q:clean(seed.topic),format:'json',categories:'news',time_range:range,_newsphi:String(now)});
          const response=await fetchImpl(`${base}/search?${params}`,{cache:'no-store',signal:ctl.signal,headers:{accept:'application/json','cache-control':'no-cache'}});
          if(!response.ok)throw Error('News provider '+response.status);
          const data=await response.json();
          return (data.results||[]).flatMap(item=>{const at=newsPublication(item,now),url=clean(item.url);if(!at||now-at>7*86400000||!/^https?:\/\//i.test(url))return [];return [{title:clean(item.title),url,excerpt:clean(item.content||item.snippet),image:clean(item.img_src||item.thumbnail),source:clean(item.source||new URL(url).hostname),publishedAt:new Date(at).toISOString(),topic:seed.topic}]});
        }finally{clearTimeout(timer)}
      }));
      if(result.every(x=>x.status==='rejected'))throw Error('News retrieval failed: '+result.map(x=>String(x.reason?.message||x.reason)).join('; '));
      const seen=new Set();return result.filter(x=>x.status==='fulfilled').flatMap(x=>x.value).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).filter(x=>!seen.has(x.url)&&seen.add(x.url)).slice(0,perSeed);
    }));
    if(batches.length&&batches.every(x=>x.status==='rejected'))throw Error('News provider unavailable: '+batches.map(x=>String(x.reason?.message||x.reason)).join('; '));
    const seen=new Set();return batches.filter(x=>x.status==='fulfilled').flatMap(x=>x.value).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)).filter(x=>!seen.has(x.url)&&seen.add(x.url));
  };
}

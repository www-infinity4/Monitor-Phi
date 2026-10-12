import test from 'node:test';import assert from 'node:assert/strict';
import {createMediaChecks,MEDIA_SURFACES} from '../src/checks/media.js';
test('News observer follows current 48-hour verified article window, not retired 7-day setting',()=>{
 const news=MEDIA_SURFACES.find(([path])=>path==='News-Phi/monitor-refresh-loop.js')[1];
 assert.ok(news.includes('ARTICLE_MAX_AGE=48*60*60*1000'));
 assert.ok(news.includes('publicationVerified'));
 assert.ok(!news.includes('windowDays:7'));
});
test('AI health checks Workers AI availability rather than retired OpenAI configuration field',async()=>{
 const url='https://infinity-rogers.marvaseater.workers.dev/health';
 const check=createMediaChecks({fetchImpl:async()=>new Response('{"service":"infinity-ai-gateway","workersAIConfigured":true,"routes":{"/v1/chat":"rogers-workers-ai"}}')}).find(x=>x.name==='media:'+url);
 assert.equal((await check.run()).ok,true);
 const blocked=createMediaChecks({fetchImpl:async()=>new Response('{"service":"infinity-ai-gateway","workersAIConfigured":false,"routes":{"/v1/chat":"rogers-workers-ai"}}')}).find(x=>x.name==='media:'+url);
 const r=await blocked.run();assert.equal(r.ok,false);assert.ok(r.missing.includes('"workersAIConfigured":true'));
});

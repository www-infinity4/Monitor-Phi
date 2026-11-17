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

test('QuantaPhi verifies the canonical media script and its current search contract', async () => {
  const url = 'https://quantaphi.org/media-repair.js';
  const [target] = MEDIA_SURFACES.find(([, markers]) => markers.includes('QuantaMediaRepair'));
  assert.equal(target, url);

  const overviewFirst = 'QuantaMediaRepair qImagesBtn qVideoBtn qSoundBtn quanta-overview-first-v2';
  const mediaFirst = overviewFirst.replace('quanta-overview-first-v2', 'quanta-intent-first-v3');
  const run = (body, status) => {
    const check = createMediaChecks({
      fetchImpl: async requested => {
        assert.equal(String(requested), url);
        return new Response(body, { status });
      },
    }).find(({ name }) => name === 'media:' + url);
    return check.run();
  };

  assert.equal((await run(mediaFirst, 200)).ok, true);
  assert.deepEqual((await run(overviewFirst, 200)).missing, ['quanta-intent-first-v3']);
  const unavailable = await run(mediaFirst, 404);
  assert.equal(unavailable.ok, false);
  assert.equal(unavailable.status, 404);
});

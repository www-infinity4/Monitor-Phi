import test from "node:test";
import assert from "node:assert/strict";
import { createSearxngNewsProvider } from "../src/providers/searxng-news.js";

test("SearXNG provider preserves the Quant topic on fresh results", async () => {
  const provider=createSearxngNewsProvider({
    endpoint:"https://search.test",
    fetchImpl:async () => new Response(JSON.stringify({results:[{
      title:"Bangkok concert update",url:"https://example.test/story",content:"Current reporting",metadata:"15 minutes ago"
    }]}),{status:200,headers:{"content-type":"application/json"}})
  });
  const rows=await provider({seeds:[{topic:"Bangkok",distance:1}]});
  assert.equal(rows[0].topic,"Bangkok");
  assert.equal(rows[0].title,"Bangkok concert update");
});


test('provider rejects undated, old and future reporting and sorts current dates',async()=>{
 const now=Date.now(),calls=[];const provider=createSearxngNewsProvider({endpoint:'https://search.test',fetchImpl:async url=>{calls.push(new URL(url));return new Response(JSON.stringify({results:[
 {title:'old',url:'https://example.test/old',publishedDate:new Date(now-30*86400000).toISOString()},
 {title:'unknown',url:'https://example.test/unknown'},
 {title:'future',url:'https://example.test/future',publishedDate:new Date(now+86400000).toISOString()},
 {title:'current',url:'https://example.test/current',metadata:'5 minutes ago'}]}))}});
 const rows=await provider({seeds:[{topic:'Bangkok'}]});assert.equal(rows.length,1);assert.equal(rows[0].title,'current');assert.deepEqual(calls.map(u=>u.searchParams.get('time_range')),['day','week']);
});

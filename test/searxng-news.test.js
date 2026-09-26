import test from "node:test";
import assert from "node:assert/strict";
import { createSearxngNewsProvider } from "../src/providers/searxng-news.js";

test("SearXNG provider preserves the Quant topic on fresh results", async () => {
  const provider=createSearxngNewsProvider({
    endpoint:"https://search.test",
    fetchImpl:async () => new Response(JSON.stringify({results:[{
      title:"Bangkok concert update",url:"https://example.test/story",content:"Current reporting"
    }]}),{status:200,headers:{"content-type":"application/json"}})
  });
  const rows=await provider({seeds:[{topic:"Bangkok",distance:1}]});
  assert.equal(rows[0].topic,"Bangkok");
  assert.equal(rows[0].title,"Bangkok concert update");
});

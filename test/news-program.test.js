import test from "node:test";
import assert from "node:assert/strict";
import { createMonitor } from "../src/index.js";
import { createQuantsProgram } from "../src/programs/quants.js";
import { createNewsProgram } from "../src/programs/news.js";

const plugin = {
  version:"test",
  graph:{quants:new Map(),flips:new Map()},
  async collect(){},
  async flip(){},
  expand(){return {quants:[],flips:[]}},
  newsSeeds(seed){return [{quantId:"q_"+seed,topic:seed,distance:0}]},
  export(){return {}}
};

test("News expands chosen topics through Quants before retrieval", async () => {
  const monitor=createMonitor();
  monitor.register(createQuantsProgram(plugin));
  monitor.register(createNewsProgram({
    provider: async ({seeds}) => seeds.map(seed => ({
      title: seed.topic+" current story",
      url: "https://example.test/"+encodeURIComponent(seed.topic),
      topic: seed.topic,
      source:"test"
    }))
  }));

  const response=await monitor.fetch(new Request("https://monitor.local/p/news/feed",{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({seeds:["Pink Floyd","Bangkok"]})
  }));
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.stories.length,2);
  assert.equal(body.stories[0].why.distance,0);
});

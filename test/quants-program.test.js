import test from "node:test";
import assert from "node:assert/strict";
import { createMonitor } from "../src/index.js";
import { createQuantsProgram } from "../src/programs/quants.js";

function fakePlugin() {
  const quants = new Map();
  return {
    version: "test",
    graph: { quants, flips: new Map() },
    async collect(input) {
      const q = { id: "q_" + (quants.size + 1), topic: input.topic };
      quants.set(q.id, q); return q;
    },
    async flip(from, to) { return { id: "bf_1", from: from.id, to: to.id }; },
    expand(seed) { return { quants: [...quants.values()].filter(q => q.topic === seed), flips: [] }; },
    newsSeeds(seed) { return [...quants.values()].filter(q => q.topic === seed).map(q => ({ quantId:q.id, topic:q.topic, distance:0 })); },
    export() { return { quants:[...quants.values()], flips:[] }; }
  };
}

test("Monitor routes Quant collection and news seeds", async () => {
  const monitor = createMonitor();
  monitor.register(createQuantsProgram(fakePlugin()));

  let response = await monitor.fetch(new Request("https://monitor.local/p/quants/collect", {
    method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({topic:"Pink Floyd"})
  }));
  assert.equal(response.status, 201);

  response = await monitor.fetch(new Request("https://monitor.local/p/quants/news-seeds", {
    method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({seeds:["Pink Floyd"]})
  }));
  const result = await response.json();
  assert.equal(result.seeds[0].topic, "Pink Floyd");
});

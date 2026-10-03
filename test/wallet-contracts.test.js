import test from "node:test";
import assert from "node:assert/strict";
import { createWalletContractChecks } from "../src/checks/wallet-contracts.js";

test("wallet contract check reports missing markers", async () => {
  const checks = createWalletContractChecks({
    surfaces: [{ name: "wallet", url: "https://example.test/", required: ["alpha", "beta"] }],
    fetchImpl: async () => new Response("alpha", { status: 200 })
  });
  const result = await checks[0].run();
  assert.equal(result.ok, false);
  assert.equal(result.contractOk, false);
  assert.deepEqual(result.missing, ["beta"]);
});

test("wallet contract check passes a complete surface", async () => {
  const checks = createWalletContractChecks({
    surfaces: [{ name: "wallet", url: "https://example.test/", required: ["alpha", "beta"] }],
    fetchImpl: async () => new Response("alpha beta", { status: 200 })
  });
  const result = await checks[0].run();
  assert.equal(result.ok, true);
  assert.equal(result.contractOk, true);
  assert.deepEqual(result.missing, []);
});

test("wallet observer rejects a disabled website handoff even when wallet markers exist", async () => {
  const [check] = createWalletContractChecks({surfaces:[{name:"paired-wallet",url:"https://example.test",required:["wallet"],forbidden:["disabled-build"]}],fetchImpl:async()=>new Response("wallet disabled-build")});
  const result=await check.run();
  assert.equal(result.ok,false);
  assert.deepEqual(result.forbidden,["disabled-build"]);
});

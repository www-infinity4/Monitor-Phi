import { createWalletContractChecks } from "../src/checks/wallet-contracts.js";

const checks = createWalletContractChecks();
const results = [];
for (const check of checks) {
  const result = await check.run({});
  results.push({ name: check.name, ...result });
}

console.log(JSON.stringify({
  checkedAt: new Date().toISOString(),
  ok: results.every(result => result.ok !== false),
  results
}, null, 2));

const failed = results.filter(result => result.ok === false);
if (failed.length) {
  console.error("Required wallet contracts failed:", failed.map(result => result.name).join(", "));
  process.exitCode = 1;
}

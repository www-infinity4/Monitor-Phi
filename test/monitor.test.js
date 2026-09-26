import test from "node:test";
import assert from "node:assert/strict";
import { createMonitor } from "../src/index.js";

test("health exposes Observer", async () => {
  const monitor = createMonitor();
  const response = await monitor.fetch(new Request("https://monitor.local/health"));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);
  assert.equal(body.programs.observer.ok, true);
});

test("routes a registered program", async () => {
  const monitor = createMonitor();
  monitor.register({
    name: "echo",
    async handle(_request, context) {
      return new Response(context.route);
    }
  });
  const response = await monitor.fetch(new Request("https://monitor.local/p/echo/hello"));
  assert.equal(await response.text(), "/hello");
});

test("unknown programs are 404", async () => {
  const monitor = createMonitor();
  const response = await monitor.fetch(new Request("https://monitor.local/p/missing/test"));
  assert.equal(response.status, 404);
});

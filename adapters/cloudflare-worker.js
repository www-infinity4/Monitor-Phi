import { createMonitor } from "../src/index.js";
import { createSearxngNewsProvider } from "../src/providers/searxng-news.js";
import { createQuantsPlugin, QuantGraph } from "../vendor/quants.js";
import { createD1QuantStore, withQuantPersistence } from "../src/storage/d1-quants.js";
import { createD1FlowStore } from "../src/storage/d1-flow.js";

let runtime;

async function getRuntime(env = {}) {
  if (runtime) return runtime;

  let quants;
  if (env.MONITOR_DB) {
    const store = createD1QuantStore(env.MONITOR_DB);
    const snapshot = await store.load();
    quants = withQuantPersistence(createQuantsPlugin(new QuantGraph(snapshot)), store);
  } else {
    quants = createQuantsPlugin();
  }
  const endpoint = env.SEARXNG_URL || "https://orange-brook-a2ac.marvaseater.workers.dev";
  const news = {
    provider: createSearxngNewsProvider({ endpoint })
  };

  const flow = env.MONITOR_DB ? { store: createD1FlowStore(env.MONITOR_DB) } : null;
  runtime = createMonitor({ quants, news, flow });
  return runtime;
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

export default {
  async fetch(request, env, executionCtx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const response = await (await getRuntime(env)).fetch(request, {
      env,
      waitUntil: executionCtx?.waitUntil?.bind(executionCtx)
    });
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};

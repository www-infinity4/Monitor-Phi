import { createMonitor } from "../src/index.js";
import { createSearxngNewsProvider } from "../src/providers/searxng-news.js";
import { createQuantsPlugin } from "../vendor/quants.js";

let runtime;

function getRuntime(env = {}) {
  if (runtime) return runtime;

  const quants = createQuantsPlugin();
  const endpoint = env.SEARXNG_URL || "https://orange-brook-a2ac.marvaseater.workers.dev";
  const news = {
    provider: createSearxngNewsProvider({ endpoint })
  };

  runtime = createMonitor({ quants, news });
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
    const response = await getRuntime(env).fetch(request, {
      env,
      waitUntil: executionCtx?.waitUntil?.bind(executionCtx)
    });
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};

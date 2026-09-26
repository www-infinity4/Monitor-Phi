import { createMonitor } from "../src/index.js";
import { createSearxngNewsProvider } from "../src/providers/searxng-news.js";

let runtime;

function getRuntime(env = {}) {
  if (runtime) return runtime;
  const news = env.SEARXNG_URL ? {
    provider: createSearxngNewsProvider({ endpoint: env.SEARXNG_URL })
  } : undefined;

  runtime = createMonitor({ news });
  return runtime;
}

export default {
  fetch(request, env, executionCtx) {
    return getRuntime(env).fetch(request, {
      env,
      waitUntil: executionCtx?.waitUntil?.bind(executionCtx)
    });
  }
};

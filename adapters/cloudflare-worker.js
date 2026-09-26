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

export default {
  fetch(request, env, executionCtx) {
    return getRuntime(env).fetch(request, {
      env,
      waitUntil: executionCtx?.waitUntil?.bind(executionCtx)
    });
  }
};

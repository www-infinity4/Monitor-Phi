import { createMonitor } from "../src/index.js";

const monitor = createMonitor();

export default {
  fetch(request, env, executionCtx) {
    return monitor.fetch(request, {
      env,
      waitUntil: executionCtx?.waitUntil?.bind(executionCtx)
    });
  }
};

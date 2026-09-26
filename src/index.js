import { Monitor } from "./monitor.js";
import { createObserverProgram } from "./programs/observer.js";
import { createQuantsProgram } from "./programs/quants.js";

export function createMonitor(options = {}) {
  const monitor = new Monitor(options);
  if (!monitor.programs.has("observer")) {
    monitor.register(createObserverProgram({ checks: options.checks || [] }));
  }
  if (options.quants && !monitor.programs.has("quants")) {
    monitor.register(createQuantsProgram(options.quants));
  }
  return monitor;
}

export { Monitor, createObserverProgram, createQuantsProgram };

import { Monitor } from "./monitor.js";
import { createObserverProgram } from "./programs/observer.js";

export function createMonitor(options = {}) {
  const monitor = new Monitor(options);
  if (!monitor.programs.has("observer")) {
    monitor.register(createObserverProgram({ checks: options.checks || [] }));
  }
  return monitor;
}

export { Monitor, createObserverProgram };

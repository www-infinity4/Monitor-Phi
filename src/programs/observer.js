import { json } from "../monitor.js";

export function createObserverProgram({ checks = [] } = {}) {
  return {
    name: "observer",
    version: "0.1.0",
    description: "Read-only health and contract observation for registered Infinity services.",

    async health() {
      return { ok: true, checks: checks.length };
    },

    async handle(request, context) {
      if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405);
      if (context.route !== "/" && context.route !== "/run") {
        return json({ error: "observer_route_not_found" }, 404);
      }

      const results = [];
      for (const check of checks) {
        const started = Date.now();
        try {
          const result = await check.run(context);
          results.push({
            name: check.name,
            ok: result?.ok !== false,
            durationMs: Date.now() - started,
            ...result
          });
        } catch (error) {
          results.push({
            name: check.name,
            ok: false,
            durationMs: Date.now() - started,
            error: String(error?.message || error)
          });
        }
      }
      return json({
        ok: results.every(x => x.ok),
        mode: "observe-only",
        results
      });
    }
  };
}

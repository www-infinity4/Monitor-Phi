import { json } from "../monitor.js";

async function body(request) {
  try { return await request.json(); }
  catch { return {}; }
}

export function createQuantsProgram(plugin) {
  if (!plugin?.collect || !plugin?.flip || !plugin?.expand || !plugin?.newsSeeds) {
    throw new TypeError("Quants program requires a compatible Quants plugin");
  }

  return {
    name: "quants",
    version: plugin.version || "1.0.0",
    description: "Topic-first Quant graph and bit-flip routing.",

    async health() {
      return {
        ok: true,
        quants: plugin.graph?.quants?.size ?? null,
        flips: plugin.graph?.flips?.size ?? null
      };
    },

    async handle(request, context) {
      const route = context.route || "/";
      const url = new URL(request.url);

      if (request.method === "POST" && route === "/collect") {
        return json({ quant: await plugin.collect(await body(request)) }, 201);
      }

      if (request.method === "POST" && route === "/flip") {
        const input = await body(request);
        const graph = plugin.graph;
        const from = graph?.quants?.get(input.from) || input.fromQuant;
        const to = graph?.quants?.get(input.to) || input.toQuant;
        if (!from?.id || !to?.id) return json({ error: "flip_endpoints_missing" }, 400);
        return json({ flip: await plugin.flip(from, to, input) }, 201);
      }

      if (request.method === "GET" && route === "/expand") {
        const seed = url.searchParams.get("seed") || url.searchParams.get("topic");
        if (!seed) return json({ error: "seed_required" }, 400);
        return json(plugin.expand(seed, {
          depth: number(url.searchParams.get("depth"), 2, 0, 8),
          limit: number(url.searchParams.get("limit"), 50, 1, 250)
        }));
      }

      if (request.method === "POST" && route === "/news-seeds") {
        const input = await body(request);
        const seeds = Array.isArray(input.seeds) ? input.seeds : [input.seed].filter(Boolean);
        const depth = number(input.depth, 2, 0, 8);
        const merged = new Map();
        for (const seed of seeds) {
          for (const item of plugin.newsSeeds(seed, { depth })) {
            const old = merged.get(item.quantId);
            if (!old || item.distance < old.distance) merged.set(item.quantId, item);
          }
        }
        return json({ seeds: [...merged.values()].sort((a,b) => a.distance - b.distance) });
      }

      if (request.method === "GET" && route === "/export") {
        return json(plugin.export());
      }

      return json({ error: "quants_route_not_found" }, 404);
    }
  };
}

function number(value, fallback, min, max) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

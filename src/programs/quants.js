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

      if (request.method === "POST" && route === "/signal") {
        const input = await body(request);
        const topic = String(input.topic || "").trim();
        const signal = String(input.signal || "").trim().toLowerCase();
        if (!topic || !["collect","uncollect","useful","reject"].includes(signal)) {
          return json({ error: "topic_and_valid_signal_required" }, 400);
        }
        const quant = plugin.graph?.findTopic(topic)?.[0] || await plugin.collect({ topic, tags:["catalog-signal"] });
        quant.catalogSignals = quant.catalogSignals || { collect:0, uncollect:0, useful:0, reject:0 };
        quant.catalogSignals[signal] = (Number(quant.catalogSignals[signal]) || 0) + 1;
        quant.catalogUpdatedAt = new Date().toISOString();
        if (plugin.store?.saveQuant) await plugin.store.saveQuant(quant);
        return json({ quantId:quant.id, topic:quant.topic, signals:quant.catalogSignals });
      }

      if (request.method === "GET" && route === "/catalog") {
        const ranked = [...(plugin.graph?.quants?.values?.() || [])].map(q => catalogScore(q, plugin.graph))
          .sort((a,b) => b.score-a.score || a.topic.localeCompare(b.topic));
        return json({ catalogs: ranked.slice(0, number(url.searchParams.get("limit"),50,1,250)) });
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

function catalogScore(q, graph) {
  const s=q.catalogSignals||{}, media=Array.isArray(q.media)?q.media:[], refinements=Array.isArray(q.refinements)?q.refinements:[],
    tags=Array.isArray(q.tags)?q.tags:[], edges=[...(graph?.flips?.values?.()||[])].filter(f=>f.from===q.id||f.to===q.id);
  const retained=Math.max(0,(Number(s.collect)||0)-(Number(s.uncollect)||0));
  const verifiedMedia=media.filter(m=>m.url&&m.type).length;
  const richness=Math.min(12, verifiedMedia*2 + Math.min(4,refinements.length) + Math.min(3,tags.length));
  const relationship=Math.min(10,edges.reduce((n,e)=>n+Math.max(0,Number(e.weight)||1),0));
  const rejection=(Number(s.uncollect)||0)*3+(Number(s.reject)||0)*4;
  const score=Math.max(0, retained*5+(Number(s.useful)||0)*4+richness+relationship-rejection);
  return {quantId:q.id,topic:q.topic,score,signals:s,metrics:{retained,verifiedMedia,richness,relationship,rejection}};
}

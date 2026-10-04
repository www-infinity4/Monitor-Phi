import { json } from "../monitor.js";

export function createNewsProgram({ provider, maxSeeds = 24 } = {}) {
  return {
    name: "news",
    version: "0.1.0",
    description: "Fresh News Phi feed orchestration from chosen Quant seeds.",

    async health() {
      return { ok: true, provider: provider ? "configured" : "not-configured" };
    },

    async handle(request, context) {
      if (request.method !== "POST" || context.route !== "/feed") {
        return json({ error: "news_route_not_found" }, 404);
      }

      const input = await readBody(request);
      const quants = context.monitor.programs.get("quants");
      if (!quants) return json({ error: "quants_program_required" }, 503);

      let chosen = unique(input.seeds || input.topics || []).slice(0, maxSeeds);
      if (!chosen.length) {
        const graph = quants.plugin?.graph;
        chosen = [...(graph?.quants?.values?.() || [])]
          .filter(q => clean(q?.topic))
          .sort((a,b) => {
            const as=a?.catalogSignals||{}, bs=b?.catalogSignals||{};
            const score=x=>Math.max(0,(Number(x.collect)||0)-(Number(x.uncollect)||0))*5+(Number(x.useful)||0)*4-(Number(x.reject)||0)*4;
            return score(bs)-score(as) || String(b?.catalogUpdatedAt||b?.createdAt||'').localeCompare(String(a?.catalogUpdatedAt||a?.createdAt||''));
          })
          .map(q => clean(q.topic))
          .filter(Boolean)
          .slice(0, maxSeeds);
      }
      if (!chosen.length) return json({ status:"empty", seeds:[], stories:[], generatedAt:new Date().toISOString() });

      const expanded = await expandThroughMonitor(context.monitor, chosen, input.depth);
      const rankedSeeds = rankExpandedSeeds(expanded.seeds, quants, chosen).slice(0, maxSeeds);

      if (!provider) {
        return json({
          status: "seeds-ready",
          seeds: rankedSeeds,
          stories: [],
          note: "Attach a fresh-news provider to retrieve current stories."
        });
      }

      let raw;
      try { raw = await provider({ seeds: rankedSeeds, request, context }); }
      catch (error) { return json({status:'unavailable',stories:[],seeds:rankedSeeds,error:String(error?.message||error),generatedAt:new Date().toISOString()},503); }
      const stories = normalizeStories(raw, rankedSeeds);
      return json({
        status: "fresh",
        seeds: rankedSeeds,
        stories,
        generatedAt: new Date().toISOString()
      });
    }
  };
}

async function expandThroughMonitor(monitor, seeds, depth = 2) {
  const request = new Request("https://monitor.internal/p/quants/news-seeds", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ seeds, depth })
  });
  const response = await monitor.fetch(request, { internal: true });
  if (!response.ok) throw new Error("Quant seed expansion failed");
  return response.json();
}

function rankExpandedSeeds(seeds, quantsProgram, chosen){
  const chosenOrder=new Map(chosen.map((x,i)=>[clean(x).toLowerCase(),i]));
  const graph=quantsProgram?.plugin?.graph;
  return [...seeds].map(seed=>{
    const quant=graph?.quants?.get?.(seed.quantId);
    const s=quant?.catalogSignals||{}, media=Array.isArray(quant?.media)?quant.media:[];
    const retained=Math.max(0,(Number(s.collect)||0)-(Number(s.uncollect)||0));
    const quality=Math.max(0,retained*5+(Number(s.useful)||0)*4+Math.min(8,media.filter(m=>m?.url&&m?.type).length*2)-(Number(s.reject)||0)*4-(Number(s.uncollect)||0)*3);
    return {...seed,catalogQuality:quality,chosenOrder:chosenOrder.get(clean(seed.topic).toLowerCase())??999};
  }).sort((a,b)=>(Number(a.distance)||0)-(Number(b.distance)||0)||a.chosenOrder-b.chosenOrder||b.catalogQuality-a.catalogQuality||clean(a.topic).localeCompare(clean(b.topic)));
}

function normalizeStories(items, seeds) {
  const allowed = new Map(seeds.map(s => [String(s.topic || "").toLowerCase(), s]));
  const seen = new Set();
  return (Array.isArray(items) ? items : []).flatMap(item => {
    const title = clean(item.title);
    const url = clean(item.url);
    if (!title || !url || seen.has(url)) return [];
    seen.add(url);
    const topic = clean(item.topic);
    const seed = allowed.get(topic.toLowerCase());
    return [{
      title,
      url,
      excerpt: clean(item.excerpt || item.description),
      image: clean(item.image),
      source: clean(item.source || item.provider),
      publishedAt: clean(item.publishedAt),
      topic: topic || seed?.topic || "",
      why: seed ? {
        quantId: seed.quantId,
        distance: seed.distance,
        seedTopic: seed.topic,
        catalogQuality: seed.catalogQuality,
        lifecycleStatus: seed.lifecycleStatus||"active"
      } : null
    }];
  });
}

const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
const unique = values => [...new Set((Array.isArray(values) ? values : [values]).map(clean).filter(Boolean))];
async function readBody(request) { try { return await request.json(); } catch { return {}; } }

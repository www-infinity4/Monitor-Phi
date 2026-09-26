import { json } from "../monitor.js";

async function body(request) {
  try { return await request.json(); }
  catch { return {}; }
}
function canonical(value){
  if(Array.isArray(value)) return "["+value.map(canonical).join(",")+"]";
  if(value&&typeof value==="object") return "{"+Object.keys(value).sort().map(k=>JSON.stringify(k)+":"+canonical(value[k])).join(",")+"}";
  return JSON.stringify(value);
}
async function sha256(value){
  const bytes=new TextEncoder().encode(value), out=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(out)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function sealQuant(quant){
  const payload={id:quant.id,parentId:quant.parentId||"",parentEnclosureId:quant.parentEnclosureId||"",scope:quant.scope||quant.topic,scopeField:quant.scopeField||"RED",topic:quant.topic,
    refinements:quant.refinements||[],media:quant.media||[],stageHistory:quant.stageHistory||[],catalogSignals:quant.catalogSignals||null};
  return {...quant,seal:{algorithm:"SHA-256",digest:await sha256(canonical(payload)),sealedAt:new Date().toISOString(),schema:"qudit-seal/v1"}};
}

export function createQuantsProgram(plugin) {
  if (!plugin?.collect || !plugin?.flip || !plugin?.expand || !plugin?.newsSeeds) {
    throw new TypeError("Quants program requires a compatible Quants plugin");
  }

  return {
    name: "quants",
    plugin,
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
          const topic = typeof seed === "string" ? seed.trim() : String(seed?.topic || "").trim();
          if (!topic) continue;
          const known = plugin.graph?.findTopic?.(topic) || [];
          if (!known.length) await plugin.collect({ topic, tags:["news-seed"] });
          for (const item of plugin.newsSeeds(topic, { depth })) {
            const old = merged.get(item.quantId);
            if (!old || item.distance < old.distance) merged.set(item.quantId, item);
          }
        }
        return json({ seeds: [...merged.values()].sort((a,b) => a.distance - b.distance) });
      }

      if (request.method === "POST" && route === "/advance") {
        const input = await body(request);
        const graph = plugin.graph;
        const quant = graph?.quants?.get(input.quantId) || graph?.findTopic?.(input.topic)?.[0];
        if (!quant) return json({ error: "quant_not_found" }, 404);
        try {
          if ((quant.lifecycleStage||quant.stage) === "BLACK" || quant.seal?.digest) return json({ error:"quant_sealed", seal:quant.seal }, 409);
          let advanced = plugin.advance(quant, input.stage, { destination:input.destination, action:input.action });
          if ((advanced.lifecycleStage||advanced.stage) === "BLACK") {
            advanced = await sealQuant(advanced);
            plugin.graph.quants.set(advanced.id, advanced);
          }
          if (plugin.store?.saveQuant) await plugin.store.saveQuant(advanced);
          return json({ quant:advanced });
        } catch (error) {
          return json({ error:"invalid_transition", message:error.message }, 409);
        }
      }

      if (request.method === "GET" && route === "/lineage") {
        const id=url.searchParams.get("id");
        if (!id) return json({ error:"id_required" },400);
        const chain=[], seen=new Set(); let q=plugin.graph?.quants?.get(id);
        while(q && !seen.has(q.id) && chain.length<100){
          chain.push(q); seen.add(q.id);
          q=q.parentId ? plugin.graph?.quants?.get(q.parentId) : null;
        }
        return json({ root:chain.at(-1)?.id||null, chain });
      }

      if (request.method === "GET" && route === "/shade") {
        const id=url.searchParams.get("id"), quant=plugin.graph?.quants?.get(id);
        if (!quant) return json({ error:"quant_not_found" },404);
        return json(plugin.shade(quant,{name:"white",view:url.searchParams.get("view")||"default"}));
      }

      if (request.method === "POST" && route === "/signal") {
        const input = await body(request);
        const topic = String(input.topic || "").trim();
        const signal = String(input.signal || "").trim().toLowerCase();
        if (!topic || !["collect","uncollect","useful","reject"].includes(signal)) {
          return json({ error: "topic_and_valid_signal_required" }, 400);
        }
        const quant = plugin.graph?.findTopic(topic)?.[0] || await plugin.collect({ topic, tags:["catalog-signal"] });
        const actionId=String(input.actionId||"").trim();
        if (!actionId) return json({ error:"action_id_required" },400);
        const observedAt=new Date().toISOString();
        if (plugin.store?.recordSignal) {
          const inserted=await plugin.store.recordSignal({actionId,quantId:quant.id,signal,topic:quant.topic,observedAt});
          if (!inserted) return json({ quantId:quant.id, topic:quant.topic, signals:quant.catalogSignals||{}, duplicate:true });
        }
        quant.catalogSignals = quant.catalogSignals || { collect:0, uncollect:0, useful:0, reject:0 };
        quant.catalogSignals[signal] = (Number(quant.catalogSignals[signal]) || 0) + 1;
        quant.catalogUpdatedAt = observedAt;
        if (plugin.store?.saveQuant) await plugin.store.saveQuant(quant);
        return json({ quantId:quant.id, topic:quant.topic, signals:quant.catalogSignals, duplicate:false });
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
  const evidence=Array.isArray(q.evidence)?q.evidence:[], claims=Array.isArray(q.claims)?q.claims:[];
  const supported=claims.filter(x=>x&&x.status==='supported').length, disputed=claims.filter(x=>x&&x.status==='disputed').length;
  const evidenceQuality=Math.min(12,evidence.reduce((n,e)=>n+(e?.quality==='primary'?3:e?.quality==='reliable'?2:e?.url?1:0),0));
  const claimConfidence=Math.max(-12,Math.min(12,supported*2-disputed*3));
  const score=Math.max(0, retained*5+(Number(s.useful)||0)*4+richness+relationship+evidenceQuality+claimConfidence-rejection);
  return {quantId:q.id,topic:q.topic,score,signals:s,metrics:{retained,verifiedMedia,richness,relationship,evidenceQuality,claimConfidence,rejection}};
}

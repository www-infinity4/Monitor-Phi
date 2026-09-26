const VERSION = "1.1.0";
export const QUDIT_STAGES = Object.freeze({ RED:"RED", BLUE:"BLUE", YELLOW:"YELLOW", BLACK:"BLACK" });
export const QUDIT_TRANSITIONS = Object.freeze({ RED:"BLUE", BLUE:"YELLOW", YELLOW:"BLACK" });

const clean = v => String(v ?? "").trim();
const norm = v => clean(v).toLocaleLowerCase().replace(/\s+/g, " ");
const uniq = a => [...new Set((a || []).map(clean).filter(Boolean))];
const hash = async input => {
  const bytes = new TextEncoder().encode(input);
  if (globalThis.crypto?.subtle) {
    const out = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(out)].map(x => x.toString(16).padStart(2,"0")).join("");
  }
  let h = 2166136261;
  for (const b of bytes) h = Math.imul(h ^ b, 16777619);
  return (h >>> 0).toString(16).padStart(8,"0");
};

export async function createQuant(input={}) {
  const topic = clean(input.topic || input.query);
  if (!topic) throw new Error("quant topic is required");
  const refinements = uniq(input.refinements);
  const media = (input.media || []).map(m => ({
    type: clean(m.type), url: clean(m.url), title: clean(m.title), source: clean(m.source)
  })).filter(m => m.type || m.url || m.title);
  const key = JSON.stringify({topic:norm(topic), refinements:refinements.map(norm), media});
  return {
    schema:"quant/v1", id:"q_"+(await hash(key)).slice(0,24), topic,
    scope:clean(input.scope || topic), stage:QUDIT_STAGES.RED,
    stageHistory:[{stage:QUDIT_STAGES.RED,at:input.createdAt || new Date().toISOString()}],
    parentId:clean(input.parentId), refinements, media, tags:uniq(input.tags),
    createdAt:input.createdAt || new Date().toISOString()
  };
}

export function advanceQudit(quant,nextStage,input={}) {
  if (!quant?.id) throw new Error("quant is required");
  const current=quant.stage || QUDIT_STAGES.RED, next=clean(nextStage).toUpperCase();
  if (QUDIT_TRANSITIONS[current]!==next) throw new Error(`invalid qudit transition: ${current} -> ${next}`);
  const at=input.at || new Date().toISOString();
  const event={stage:next,at};
  if (input.destination) event.destination=clean(input.destination);
  if (input.action) event.action=clean(input.action);
  return {...quant,stage:next,stageHistory:[...(quant.stageHistory||[]),event]};
}

export function shadeQudit(quant,shader={}) {
  if (!quant?.id) throw new Error("quant is required");
  return {schema:"qudit-shader/v1",quantId:quant.id,scope:quant.scope||quant.topic,
    stage:quant.stage||QUDIT_STAGES.RED,shader:{name:clean(shader.name||"white"),view:clean(shader.view||"default")}};
}

export async function createBitFlip(from, to, input={}) {
  if (!from?.id || !to?.id) throw new Error("from and to quants are required");
  const relation = clean(input.relation || "refined-to");
  const key = [from.id,to.id,norm(relation)].join("|");
  return {
    schema:"bit-flip/v1", id:"bf_"+(await hash(key)).slice(0,24),
    from:from.id, to:to.id, relation,
    weight:Number.isFinite(+input.weight) ? +input.weight : 1,
    observedAt:input.observedAt || new Date().toISOString()
  };
}

export class QuantGraph {
  constructor(snapshot={}) {
    this.quants = new Map((snapshot.quants || []).map(q => [q.id,q]));
    this.flips = new Map((snapshot.flips || []).map(f => [f.id,f]));
  }
  addQuant(q){ if (!q?.id) throw new Error("invalid quant"); this.quants.set(q.id,q); return q; }
  addFlip(f){ if (!f?.id || !this.quants.has(f.from) || !this.quants.has(f.to)) throw new Error("flip endpoints missing"); this.flips.set(f.id,f); return f; }
  findTopic(topic){ const n=norm(topic); return [...this.quants.values()].filter(q => norm(q.topic)===n); }
  expand(seed,{depth=2,limit=50}={}) {
    const starts = this.quants.has(seed) ? [seed] : this.findTopic(seed).map(q=>q.id);
    const seen = new Map(starts.map(id=>[id,0])); const queue=[...starts]; const edges=[];
    while(queue.length && seen.size < limit){
      const id=queue.shift(), d=seen.get(id); if(d>=depth) continue;
      for(const f of this.flips.values()){
        if(f.from!==id && f.to!==id) continue;
        const next=f.from===id?f.to:f.from; edges.push(f);
        if(!seen.has(next)){ seen.set(next,d+1); queue.push(next); if(seen.size>=limit) break; }
      }
    }
    return {quants:[...seen].map(([id,distance])=>({...this.quants.get(id),distance})), flips:[...new Map(edges.map(e=>[e.id,e])).values()]};
  }
  newsSeeds(seed,opts={}) {
    const x=this.expand(seed,opts);
    return x.quants.map(q=>({quantId:q.id,topic:q.topic,distance:q.distance,tags:q.tags||[],refinements:q.refinements||[]}));
  }
  toJSON(){ return {schema:"quants-graph/v1",version:VERSION,quants:[...this.quants.values()],flips:[...this.flips.values()]}; }
}

export function createQuantsPlugin(graph=new QuantGraph()){
  return {
    version:VERSION, graph,
    async collect(input){ const q=await createQuant(input); return graph.addQuant(q); },
    async flip(from,to,input){ const f=await createBitFlip(from,to,input); return graph.addFlip(f); },
    advance(quant,nextStage,input){ const q=advanceQudit(quant,nextStage,input); return graph.addQuant(q); },
    shade:(quant,shader)=>shadeQudit(quant,shader),
    expand:(seed,opts)=>graph.expand(seed,opts),
    newsSeeds:(seed,opts)=>graph.newsSeeds(seed,opts),
    export:()=>graph.toJSON()
  };
}

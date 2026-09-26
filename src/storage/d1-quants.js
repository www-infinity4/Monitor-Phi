export function createD1QuantStore(db) {
  if (!db?.prepare) throw new TypeError("D1 database binding is required");
  return {
    async ensureSignalSchema() {
      await db.prepare(`CREATE TABLE IF NOT EXISTS quant_signals (
        action_id TEXT PRIMARY KEY, quant_id TEXT NOT NULL, signal TEXT NOT NULL,
        topic TEXT NOT NULL, observed_at TEXT NOT NULL
      )`).run();
    },
    async applySignal({actionId,quant,signal,observedAt}) {
      await this.ensureSignalSchema();
      const existing=await db.prepare("SELECT data_json FROM quants WHERE id=?").bind(quant.id).first();
      if(existing?.data_json){
        const prior=JSON.parse(existing.data_json);
        if((prior.lifecycleStage||prior.stage)==="BLACK"||prior.seal?.digest) throw new Error("sealed_quant_immutable");
      }
      const duplicate=await db.prepare("SELECT action_id FROM quant_signals WHERE action_id=?").bind(actionId).first();
      if(duplicate) return {applied:false,quant:existing?.data_json?JSON.parse(existing.data_json):quant};
      const statements=[
        db.prepare(`INSERT INTO quant_signals(action_id,quant_id,signal,topic,observed_at) VALUES(?,?,?,?,?)`)
          .bind(actionId,quant.id,signal,quant.topic,observedAt),
        db.prepare(`INSERT INTO quants(id,topic,topic_norm,data_json,created_at)
          VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json`)
          .bind(quant.id,quant.topic,String(quant.topic||"").trim().toLowerCase(),JSON.stringify(quant),quant.createdAt)
      ];
      await db.batch(statements);
      return {applied:true,quant};
    },
    async load() {
      const [q, f] = await Promise.all([
        db.prepare("SELECT data_json FROM quants ORDER BY created_at").all(),
        db.prepare("SELECT data_json FROM quant_flips ORDER BY observed_at").all()
      ]);
      return {
        quants: (q.results || []).map(row => JSON.parse(row.data_json)),
        flips: (f.results || []).map(row => JSON.parse(row.data_json))
      };
    },
    async saveQuant(quant) {
      const existing=await db.prepare("SELECT data_json FROM quants WHERE id=?").bind(quant.id).first();
      if(existing?.data_json){
        const prior=JSON.parse(existing.data_json);
        if((prior.lifecycleStage||prior.stage)==="BLACK"||prior.seal?.digest){
          if(JSON.stringify(prior)!==JSON.stringify(quant)) throw new Error("sealed_quant_immutable");
          return prior;
        }
      }
      await db.prepare(`INSERT INTO quants(id,topic,topic_norm,data_json,created_at)
        VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json`)
        .bind(quant.id, quant.topic, String(quant.topic||"").trim().toLowerCase(), JSON.stringify(quant), quant.createdAt).run();
      return quant;
    },
    async saveFlip(flip) {
      await db.prepare(`INSERT INTO quant_flips(id,from_id,to_id,relation,data_json,observed_at)
        VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data_json=excluded.data_json`)
        .bind(flip.id, flip.from, flip.to, flip.relation, JSON.stringify(flip), flip.observedAt).run();
      return flip;
    }
  };
}

export function withQuantPersistence(plugin, store) {
  const collect = plugin.collect.bind(plugin);
  const flip = plugin.flip.bind(plugin);
  return {
    ...plugin,
    store,
    async collect(input) {
      const quant = await collect(input);
      await store.saveQuant(quant);
      return quant;
    },
    async flip(from, to, input) {
      const edge = await flip(from, to, input);
      await store.saveFlip(edge);
      return edge;
    }
  };
}

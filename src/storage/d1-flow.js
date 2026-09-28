const parse = value => { try { return JSON.parse(value || "{}"); } catch { return {}; } };

export function createD1FlowStore(db) {
  let ready;
  const ensure = () => ready ||= db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS flow_jobs (
      id TEXT PRIMARY KEY, target TEXT NOT NULL, goal TEXT NOT NULL, repo TEXT NOT NULL DEFAULT '',
      quant_id TEXT NOT NULL DEFAULT '', source TEXT NOT NULL DEFAULT 'phi', risk TEXT NOT NULL DEFAULT 'low',
      status TEXT NOT NULL, agent TEXT NOT NULL DEFAULT '', metadata_json TEXT NOT NULL DEFAULT '{}',
      result_json TEXT NOT NULL DEFAULT '{}', verification_json TEXT NOT NULL DEFAULT '{}',
      error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS flow_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, kind TEXT NOT NULL,
      data_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_flow_jobs_status ON flow_jobs(status, updated_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_flow_events_job ON flow_events(job_id, id)")
  ]);

  const map = row => row && ({
    id: row.id, target: row.target, goal: row.goal, repo: row.repo, quantId: row.quant_id,
    source: row.source, risk: row.risk, status: row.status, agent: row.agent,
    metadata: parse(row.metadata_json), result: parse(row.result_json),
    verification: parse(row.verification_json), error: row.error,
    createdAt: row.created_at, updatedAt: row.updated_at
  });

  return {
    async createJob(job) {
      await ensure(); const now = job.createdAt || new Date().toISOString();
      await db.prepare(`INSERT INTO flow_jobs
        (id,target,goal,repo,quant_id,source,risk,status,metadata_json,created_at,updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)`).bind(
          job.id,job.target,job.goal,job.repo||"",job.quantId||"",job.source||"phi",job.risk||"low",
          job.status||"queued",JSON.stringify(job.metadata||{}),now,now
        ).run();
      return job;
    },
    async getJob(id) { await ensure(); return map(await db.prepare("SELECT * FROM flow_jobs WHERE id=?").bind(id).first()); },
    async listJobs({ status="", limit=50 }={}) {
      await ensure(); limit=Math.max(1,Math.min(200,Number(limit)||50));
      const q=status ? db.prepare("SELECT * FROM flow_jobs WHERE status=? ORDER BY updated_at DESC LIMIT ?").bind(status,limit)
                     : db.prepare("SELECT * FROM flow_jobs ORDER BY updated_at DESC LIMIT ?").bind(limit);
      return (await q.all()).results.map(map);
    },
    async addEvent(jobId,kind,data={}) {
      await ensure(); await db.prepare("INSERT INTO flow_events(job_id,kind,data_json,created_at) VALUES(?,?,?,?)")
        .bind(jobId,kind,JSON.stringify(data),new Date().toISOString()).run();
    },
    async listEvents(jobId) {
      await ensure(); const out=await db.prepare("SELECT id,kind,data_json,created_at FROM flow_events WHERE job_id=? ORDER BY id").bind(jobId).all();
      return out.results.map(x=>({id:x.id,kind:x.kind,data:parse(x.data_json),createdAt:x.created_at}));
    },
    async transition(id,from,to,patch={}) {
      await ensure(); const current=await this.getJob(id); if(!current||!from.includes(current.status)) return null;
      const next={
        agent: patch.agent ?? current.agent, result: patch.result ?? current.result,
        verification: patch.verification ?? current.verification, error: patch.error ?? current.error
      };
      const now=new Date().toISOString();
      const r=await db.prepare(`UPDATE flow_jobs SET status=?,agent=?,result_json=?,verification_json=?,error=?,updated_at=?
        WHERE id=? AND status=?`).bind(to,next.agent||"",JSON.stringify(next.result||{}),JSON.stringify(next.verification||{}),next.error||"",now,id,current.status).run();
      if(!r.meta?.changes) return null; return this.getJob(id);
    }
  };
}

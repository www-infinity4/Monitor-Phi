import { json } from "../monitor.js";

const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();
const id = prefix => prefix + "_" + crypto.randomUUID();

export function createFlowProgram({ store } = {}) {
  return {
    name: "flow",
    version: "0.1.0",
    description: "Durable Phi improvement jobs, evidence, agent assignments, and verification gates.",

    async health() {
      return { ok: Boolean(store), durable: Boolean(store), mode: "improve-verify" };
    },

    async handle(request, context) {
      if (!store) return json({ error: "flow_store_required" }, 503);
      const route = context.route || "/";
      const url = new URL(request.url);

      if (request.method === "POST" && route === "/jobs") {
        const body = await readBody(request);
        const target = clean(body.target);
        const goal = clean(body.goal);
        if (!target || !goal) return json({ error: "target_and_goal_required" }, 400);
        const job = {
          id: id("flow"), target, goal,
          repo: clean(body.repo),
          quantId: clean(body.quantId),
          source: clean(body.source || "phi"),
          risk: ["read","low","medium","high"].includes(body.risk) ? body.risk : "low",
          status: "queued",
          createdAt: new Date().toISOString(),
          metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
        };
        await store.createJob(job);
        await store.addEvent(job.id, "queued", { source: job.source });
        return json({ job }, 201);
      }

      if (request.method === "GET" && route === "/jobs") {
        const status = clean(url.searchParams.get("status"));
        return json({ jobs: await store.listJobs({ status, limit: Number(url.searchParams.get("limit")) || 50 }) });
      }

      const match = route.match(/^\/jobs\/([^/]+)(?:\/(claim|event|verify|complete|fail))?$/);
      if (!match) return json({ error: "flow_route_not_found" }, 404);
      const jobId = match[1], action = match[2];

      if (request.method === "GET" && !action) {
        const job = await store.getJob(jobId);
        return job ? json({ job, events: await store.listEvents(jobId) }) : json({ error: "job_not_found" }, 404);
      }

      const body = await readBody(request);
      if (request.method === "POST" && action === "claim") {
        const agent = clean(body.agent);
        if (!agent) return json({ error: "agent_required" }, 400);
        const job = await store.transition(jobId, ["queued"], "running", { agent });
        if (!job) return json({ error: "job_not_claimable" }, 409);
        await store.addEvent(jobId, "claimed", { agent });
        return json({ job });
      }

      if (request.method === "POST" && action === "event") {
        const kind = clean(body.kind);
        if (!kind) return json({ error: "event_kind_required" }, 400);
        await store.addEvent(jobId, kind, body.data || {});
        return json({ ok: true });
      }

      if (request.method === "POST" && action === "verify") {
        const passed = body.passed === true;
        const evidence = body.evidence || {};
        await store.addEvent(jobId, passed ? "verification_passed" : "verification_failed", evidence);
        const job = await store.transition(jobId, ["running","verifying"], passed ? "verified" : "needs_work", {
          verification: evidence
        });
        return job ? json({ job }) : json({ error: "job_not_verifiable" }, 409);
      }

      if (request.method === "POST" && action === "complete") {
        const job = await store.transition(jobId, ["verified"], "completed", { result: body.result || {} });
        if (!job) return json({ error: "verification_required_before_completion" }, 409);
        await store.addEvent(jobId, "completed", body.result || {});
        return json({ job });
      }

      if (request.method === "POST" && action === "fail") {
        const job = await store.transition(jobId, ["queued","running","verifying","needs_work"], "failed", { error: clean(body.error) });
        if (!job) return json({ error: "job_not_fail-able" }, 409);
        await store.addEvent(jobId, "failed", { error: clean(body.error) });
        return json({ job });
      }

      return json({ error: "method_not_allowed" }, 405);
    }
  };
}

async function readBody(request) { try { return await request.json(); } catch { return {}; } }

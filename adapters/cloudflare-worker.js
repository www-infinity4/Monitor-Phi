import { createMonitor, createQuantsProgram } from "../src/index.js";
import { createSearxngNewsProvider } from "../src/providers/searxng-news.js";
import { createQuantsPlugin, QuantGraph } from "../vendor/quants.js";
import { createD1QuantStore, withQuantPersistence } from "../src/storage/d1-quants.js";
import { createD1FlowStore } from "../src/storage/d1-flow.js";
import { createWalletContractChecks } from "../src/checks/wallet-contracts.js";
import { createMediaChecks } from "../src/checks/media.js";
import { createInfinityRecoveryChecks } from '../src/checks/infinity-recovery.js';

let runtime;
let graphLoaded = false, graphLoading = null, graphFailed = false, graphRetryAt = 0;
const GRAPH_RETRY_MS = 60000;
// Only the supported method/route pairs in the Quants program need a graph.
// Invalid URLs and wrong methods must keep their normal 404 without a scan.
const GRAPH_ROUTES = new Set([
  "POST /collect", "POST /flip", "POST /news-seeds", "POST /advance", "POST /signal",
  "GET /expand", "GET /lineage", "GET /shade", "GET /lifecycle", "GET /catalog", "GET /export"
]);

function getRuntime(env = {}) {
  if (runtime) return runtime;

  const endpoint = env.SEARXNG_URL || "https://orange-brook-a2ac.marvaseater.workers.dev";
  const news = {
    provider: createSearxngNewsProvider({ endpoint, fetchImpl: env.NEWS_SEARCH ? (input, init) => env.NEWS_SEARCH.fetch(new Request(input, init)) : fetch })
  };

  const flow = env.MONITOR_DB ? { store: createD1FlowStore(env.MONITOR_DB) } : null;
  // Program discovery and observation must not hydrate the complete Quant
  // history. Null counts mean not loaded, never an empty replacement ledger.
  const quants = {
    name: "quants", version: "1.1.0", description: "Topic-first Quant graph and bit-flip routing.",
    async health() {
      return {ok:!graphFailed, loaded:false, state:graphLoading ? "loading" : graphFailed ? "unavailable" : "not_loaded", quants:null, flips:null};
    },
    async handle() {
      return Response.json({error:"quants_route_not_found"}, {status:404});
    }
  };
  runtime = createMonitor({programs:[quants], news, flow, checks:[...createWalletContractChecks(), ...createMediaChecks(), ...createInfinityRecoveryChecks()]});
  return runtime;
}

async function loadGraph(env, monitor) {
  if (graphLoaded) return;
  if (graphLoading) return graphLoading;
  if (Date.now() < graphRetryAt) throw Error("quant_storage_temporarily_unavailable");
  const pending = (async () => {
    let quants;
    if (env.MONITOR_DB) {
      const store = createD1QuantStore(env.MONITOR_DB);
      const snapshot = await store.load();
      quants = withQuantPersistence(createQuantsPlugin(new QuantGraph(snapshot)), store);
    } else quants = createQuantsPlugin();
    const program = createQuantsProgram(quants), health = program.health;
    program.health = async () => ({...await health(), loaded:true, state:"loaded"});
    monitor.register(program);
    graphLoaded = true;
    graphFailed = false;
    graphRetryAt = 0;
  })();
  graphLoading = pending;
  try { await pending; }
  catch (error) {
    graphFailed = true;
    graphRetryAt = Date.now() + GRAPH_RETRY_MS;
    throw error;
  } finally { graphLoading = null; }
}

const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type"
};

export default {
  async fetch(request, env = {}, executionCtx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const monitor = getRuntime(env);
    // Match Monitor's existing path normalization, including trailing slashes.
    const parts = new URL(request.url).pathname.split("/").filter(Boolean);
    const route = request.method + " /" + parts.slice(2).join("/");
    const needsGraph = parts[0] === "p" &&
      ((parts[1] === "quants" && GRAPH_ROUTES.has(route)) || (parts[1] === "news" && route === "POST /feed"));
    if (needsGraph) {
      try { await loadGraph(env, monitor); }
      catch {
        return Response.json({error:"quant_storage_temporarily_unavailable"}, {status:503, headers:{
          ...cors, "cache-control":"no-store", "retry-after":String(Math.max(1, Math.ceil((graphRetryAt - Date.now()) / 1000)))
        }});
      }
    }
    const response = await monitor.fetch(request, {
      env,
      waitUntil: executionCtx?.waitUntil?.bind(executionCtx)
    });
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  }
};

import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';

let instance = 0;
const loadWorker = async () => (await import(`../adapters/cloudflare-worker.js?lazy-test=${++instance}`)).default;
const request = path => new Request('https://monitor.test' + path);

function database({unavailable = false, gate = null} = {}) {
  const graphReads = [], otherReads = [];
  const snapshot = {
    quants: [
      {id:'q_original', topic:'Original', createdAt:'2026-10-01T00:00:00Z'},
      {id:'q_sealed', topic:'Preserved', createdAt:'2026-10-02T00:00:00Z', stage:'BLACK', seal:{digest:'verified-existing-seal'}}
    ],
    flips: [{id:'f_original', from:'q_original', to:'q_sealed', observedAt:'2026-10-02T00:00:00Z'}]
  };
  const db = {
    prepare(sql) {
      const statement = {
        bind() { return statement; },
        async all() {
          if (/SELECT data_json FROM (quants|quant_flips) ORDER BY/.test(sql)) {
            graphReads.push(sql);
            if (gate) await gate;
            if (unavailable) throw Error('D1_ERROR: free tier daily row read limit');
            const rows = sql.includes('FROM quant_flips') ? snapshot.flips : snapshot.quants;
            return {results:rows.map(value => ({data_json:JSON.stringify(value)}))};
          }
          otherReads.push(sql);
          return {results:[]};
        },
        async first() { otherReads.push(sql); return null; },
        async run() { return {success:true}; }
      };
      return statement;
    },
    async batch(statements) { return statements.map(() => ({success:true})); }
  };
  return {db, graphReads, otherReads, snapshot};
}

test('health and program discovery work without reading the Quant graph during a D1 outage', async () => {
  const worker = await loadWorker(), {db, graphReads, otherReads} = database({unavailable:true});
  const response = await worker.fetch(request('/health'), {MONITOR_DB:db});
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.programs.quants.loaded, false);
  assert.equal(health.programs.quants.state, 'not_loaded');
  assert.equal(health.programs.quants.quants, null);
  assert.equal(health.programs.quants.flips, null);
  const programs = await (await worker.fetch(request('/programs'), {MONITOR_DB:db})).json();
  assert.deepEqual(programs.programs.map(p => p.name).sort(), ['flow','news','observer','quants']);
  assert.equal((await worker.fetch(request('/missing'), {MONITOR_DB:db})).status, 404);
  assert.equal((await worker.fetch(new Request('https://monitor.test/p/quants/export', {method:'OPTIONS'}), {MONITOR_DB:db})).status, 204);
  assert.equal(graphReads.length, 0);
  assert.equal(otherReads.length, 0);
});

test('Observer checks and flow listing are independent of full Quant graph initialization', async t => {
  const worker = await loadWorker(), {db, graphReads, otherReads} = database({unavailable:true});
  t.mock.method(globalThis, 'fetch', async () => new Response('Synthetic source unavailable', {status:503}));
  const observed = await worker.fetch(request('/p/observer/run'), {MONITOR_DB:db});
  assert.equal(observed.status, 200);
  assert.equal((await observed.json()).mode, 'observe-only');
  const flow = await worker.fetch(request('/p/flow/jobs'), {MONITOR_DB:db});
  assert.equal(flow.status, 200);
  assert.deepEqual((await flow.json()).jobs, []);
  assert.equal(graphReads.length, 0);
  assert.ok(otherReads.some(sql => sql.includes('FROM flow_jobs')));
});

for (const [method, path] of [
  ['GET', '/p/quants/unknown'],
  ['GET', '/p/quants/collect'],
  ['POST', '/p/quants/export'],
  ['DELETE', '/p/quants/collect']
]) {
  test(`unsupported Quant request ${method} ${path} preserves 404 without loading stored records`, async () => {
    const worker = await loadWorker(), {db, graphReads, otherReads} = database({unavailable:true});
    const response = await worker.fetch(new Request('https://monitor.test' + path, {method}), {MONITOR_DB:db});
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error, 'quants_route_not_found');
    assert.equal(graphReads.length, 0);
    assert.equal(otherReads.length, 0);
  });
}

test('concurrent graph requests share one load and retain the complete existing snapshot', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const worker = await loadWorker(), {db, graphReads, snapshot} = database({gate});
  const first = worker.fetch(request('/p/quants/export'), {MONITOR_DB:db});
  const second = worker.fetch(request('/p/quants/export'), {MONITOR_DB:db});
  await setImmediate();
  assert.equal(graphReads.length, 2, 'one Quant query and one flip query for the concurrent requests');
  release();
  for (const response of await Promise.all([first, second])) {
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.deepEqual(data.quants, snapshot.quants);
    assert.deepEqual(data.flips, snapshot.flips);
  }
  await worker.fetch(request('/p/quants/export'), {MONITOR_DB:db});
  assert.equal(graphReads.length, 2);
  const health = await (await worker.fetch(request('/health'), {MONITOR_DB:db})).json();
  assert.equal(health.programs.quants.loaded, true);
  assert.equal(health.programs.quants.quants, 2);
});

test('failed graph initialization returns temporary unavailability and suppresses immediate retry storms', async t => {
  let clock = Date.now();
  t.mock.method(Date, 'now', () => clock);
  const worker = await loadWorker(), {db, graphReads} = database({unavailable:true});
  for (const path of ['/p/quants/export', '/p/quants/export']) {
    const response = await worker.fetch(request(path), {MONITOR_DB:db});
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('retry-after'), '60');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('access-control-allow-origin'), '*');
    const body = await response.json();
    assert.equal(body.error, 'quant_storage_temporarily_unavailable');
    assert.equal(Object.hasOwn(body, 'quants'), false, 'never replace unavailable stored records with an empty graph');
  }
  assert.equal(graphReads.length, 2);
  const health = await (await worker.fetch(request('/health'), {MONITOR_DB:db})).json();
  assert.equal(health.programs.quants.ok, false);
  assert.equal(health.programs.quants.state, 'unavailable');
  assert.equal(health.programs.quants.quants, null);
  assert.equal(graphReads.length, 2, 'health must not retry an unavailable graph');
  clock += 61000;
  assert.equal((await worker.fetch(request('/p/quants/export'), {MONITOR_DB:db})).status, 503);
  assert.equal(graphReads.length, 4, 'a later graph request can retry after the bounded cooldown');
});

test('News graph dependency fails closed before external provider calls when storage is unavailable', async () => {
  const worker = await loadWorker(), {db, graphReads} = database({unavailable:true});
  let providerCalls = 0;
  const env = {MONITOR_DB:db, NEWS_SEARCH:{fetch:async () => { providerCalls++; throw Error('provider must not be called'); }}};
  const response = await worker.fetch(new Request('https://monitor.test/p/news/feed', {
    method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({seeds:['Original']})
  }), env);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, 'quant_storage_temporarily_unavailable');
  assert.equal(providerCalls, 0);
  assert.equal(graphReads.length, 2);
});

# Monitor Phi

Monitor Phi is the planned infrastructure control plane and runtime for Infinity websites. Its long-term goal is to remove the network's dependency on Cloudflare by providing the services Infinity applications currently obtain from external hosting, worker, database, storage and edge infrastructure.

It is more than an activity monitor.

## Mission

Monitor Phi should provide one place to deploy, observe, repair and operate Infinity applications while keeping application code portable. Migration should be incremental: existing Cloudflare-backed services remain usable until a Monitor Phi equivalent is implemented, tested and cut over.

## Target capabilities

### Runtime and deployment
- deploy application and API code from versioned source
- isolated worker/service execution
- environment and configuration management
- versioned releases, health checks and rollback
- scheduled jobs and queues

### Network and edge
- HTTP routing and custom domains
- TLS termination
- caching and static asset delivery
- request limits and abuse protection
- service-to-service routing

### Data
- durable SQL-compatible application storage
- key/value and object/blob storage
- migrations, backups and restore
- portable export so applications are not locked to Monitor Phi either

### Observation
- uptime and endpoint health
- structured logs
- errors and latency
- deployment status
- dependency health
- alerts and incident history

### AI / automation oversight
- bots and maintenance agents can inspect declared health signals
- automated repair actions must be bounded, logged and reversible
- deployments and repairs should retain an audit trail
- destructive actions require explicit safeguards

## Cloudflare replacement map

| Current dependency | Monitor Phi target |
| --- | --- |
| Workers | Monitor Runtime |
| D1 | Monitor SQL |
| R2 | Monitor Object Store |
| KV | Monitor KV |
| Queues | Monitor Queue |
| Cron Triggers | Monitor Scheduler |
| Pages/static hosting | Monitor Sites |
| CDN/cache | Monitor Edge |
| DNS/routing | Monitor Network |
| Worker logs/analytics | Monitor Observe |

This table is a migration target, not a claim that every replacement already exists.

## Migration rule

Applications should talk to small adapters rather than Cloudflare-specific APIs directly. During migration an adapter may use Cloudflare; once the matching Monitor Phi service is ready, the adapter can switch providers without rewriting the application.

`Infinity app -> portable service adapter -> Monitor Phi`

This allows Quants, News Phi, Shop Phi, Electric Phi, Infinity Radio and other sites to move independently instead of requiring one dangerous all-at-once cutover.

## First implementation milestone

1. Define a service manifest for an Infinity application.
2. Run one HTTP service outside Cloudflare.
3. Add health/log collection.
4. provide persistent SQL and object storage.
5. Deploy from a Git commit with a versioned release.
6. Verify rollback.
7. Move one non-critical Infinity application through the full path.
8. Only then begin replacing production Cloudflare dependencies individually.

## Principle

Monitor Phi should be observable, reproducible and portable. A replacement for vendor lock-in should not create a new lock-in.

## Status

Architecture repository. Cloudflare remains required wherever an existing Infinity application still depends on Cloudflare services until the corresponding Monitor Phi component has been implemented, tested and migrated.


## Implemented foundation

Monitor Phi now includes the first portable runtime:

- `src/monitor.js` — program registry, `/health`, `/programs`, and `/p/:program/*` routing.
- `src/programs/observer.js` — Observer as a Monitor program with bounded read-only checks.
- `src/index.js` — runtime factory.
- `adapters/cloudflare-worker.js` — intentionally thin Cloudflare gateway adapter.
- `test/monitor.test.js` — routing and health tests.

The boundary is now concrete:

`Internet -> gateway adapter -> Monitor -> registered program`

A program only needs a name and a `handle(request, context)` function. This means future News, Quants, wallet, scheduler and repair programs can live behind one Monitor router instead of each requiring a separate Cloudflare Worker.

### Routes

- `GET /health` — aggregate program health.
- `GET /programs` — registered programs.
- `/p/observer/` — run Observer checks.
- `/p/<name>/*` — dispatch to any registered Monitor program.

The Cloudflare adapter is transitional. Monitor's core imports no Cloudflare API, so another HTTP host can call the same `monitor.fetch(request, context)` entry point later.


## Quants program

Monitor now has a Quants program adapter. The Quant graph remains owned by the Quants package; Monitor supplies routing and hosting.

When `createMonitor({ quants: plugin })` receives a compatible Quants plugin, these routes are registered:

- `POST /p/quants/collect` — create/collect a Quant.
- `POST /p/quants/flip` — record a relationship/bit flip.
- `GET /p/quants/expand?seed=...&depth=2` — traverse related Quants.
- `POST /p/quants/news-seeds` — merge one or more chosen topics into ranked News Phi seeds.
- `GET /p/quants/export` — portable graph export.

This keeps the deployment boundary clean: Quants defines the graph; Monitor runs it; a gateway only forwards HTTP.

### Lifecycle analytics

`GET /p/quants/lifecycle?staleMinutes=30` derives `active`, `abandoned`, and `sealed` status without adding a fifth lifecycle color or mutating a Quant. BLACK/sealed records remain authoritative completions; stale RED/BLUE/YELLOW records are reported as abandoned only at the analytics layer.

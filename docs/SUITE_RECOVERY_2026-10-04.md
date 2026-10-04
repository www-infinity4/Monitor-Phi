# QuantaPhi org suite recovery — October 4, 2026

## Verified fixes

- QuantaPhi AI: the service allowed .net but rejected .org. Commit `f8b5ed72a2cda3eb7d6200d8df63790d3cc7ac43` adds the two existing app hostnames. Live org preflight and browser overview succeed.
- QuantaPhi banner and Omni paths: QuantaPhi commit `656587be2e6243c65a5186440dc7261ef6937243` removes visible wallet diagnostic banners, retaining diagnostic state. Root Omni aliases now redirect to `/omni-phi/...` preserving query/token parameters. Relative overview scripts now resolve inside Omni instead of missing Quanta root `/assets` files.
- Omni AI: commit `855023e1cb36a1eb5b3c416dc8d3e13bd5e73799` bounds complete evidence JSON under the AI service's 12,000-character input limit. The browser had reproduced `prompt_too_large` after the routing repair. The budget test includes oversized evidence and verifies valid JSON and the actual retained source count.
- News: commit `f6aee5b089987c991ab32ecdce536dec86c4db82` puts stored-term signals into the loaded pipeline, requires real recent publication evidence, canonicalizes tracking URL variants, excludes collected original URLs, deduplicates against saved cards and preserves the feed across retrieval failures. Monitor fallback sends only its allowed Content-Type header, retains saved cards on empty results and applies the same date/canonical stack rules.

## Live verification

The QuantaPhi wallet banner is absent. QuantaPhi's Iran test search completes with an AI Overview. Omni's Iran test overview and source cards load after the alias routing fix. News Phi visibly reports `20 new` and displays publisher-backed dated articles. These are test browser results, not verification of the user's phone account balance; the user independently confirmed balances and history before this turn.

Infinity initially reported a ChunkLoadError for `0d477de7184705c6.js`. That exact URL and its origin URL subsequently returned valid JavaScript. Its 16 deployed script/chunk URLs pass the observer's HTTP/type checks, as do Omni's 16 script URLs. A cloud-browser policy error blocked the Infinity reload; interactive search, wallet and text selection on Infinity remain unverified in this turn. Do not report this limitation as proof that Infinity is repaired or that the user's device is blocked.

## Checks and boundaries

`GET https://monitor-phi.marvaseater.workers.dev/p/observer/run` checks the actual .org wallet cache safeguards, idle builder, education builder, strict fresh-news markers and both apps' served scripts. It is read-only and does not reset storage, change wallet identity or roll back code automatically.

Use `python scripts/check-suite-connections.py` from an external runner to verify org CORS for AI, news, search and all three ledger services. It uses no credentials or ledger writes. Worker-to-Worker OPTIONS requests return platform 404s in this deployment, so those preflight probes are opt-in rather than producing a false app-outage report in the Worker observer.

Regression suites: QuantaPhi `domain-health`, `suite-routing`, `ai-origin`, `cloud-connection`, `wallet-recovery-routing`, `search-commit`; News Phi `indexed-news`, `store-signal`, `monitor-fallback`; Omni Phi `overview-budget`; Monitor Phi `suite-recovery`. Keep the tests and recovery record when editing any of these contracts.

Source availability determines how many genuinely new articles exist. A repeated retrieval must not reclassify saved URLs as newly published stories. Unknown dates remain unknown. Preserve account IDs, cloud ledger records, historical token IDs, separate asset balances and the earlier Unicode/cache/idle fixes. Before any rollback, compare the failing files with these commits and the earlier Infinity recovery record; revert only the identified faulty change.

# Infinity saved-history recovery

Known working repair: [C13b0 commit 3e6196b](https://github.com/www-infinity4/C13b0/commit/3e6196b4363d0269a8ed02626d5c2116eab7de5a). Previous baseline: b410a5ccbe53fff849c5568dc123847d4b60436b.

The failure reproduced with 230 sample saved research records, approximately 1.97 MB encoded. Repeated wallet reads decoded and recounted the same history, while hidden site builds competed with typing and selection. Browser wallet reads before repair were 408/262/260/230 ms; after repair they were 20/0/0/0 ms. These are sample-device measurements, not the user's private data.

## Restore the working safeguards

1. Read `/p/observer/run` and `/p/observer/recovery` on the Monitor worker. Check missing markers and compare the failing source with the working commit. A green static check cannot certify all mobile behavior.
2. In `public/wallet-runtime.js`, retain ledger decode caching and canonical count caching keyed by all relevant raw inputs, including account/session/profile changes. In `public/unified-token-count.js`, retain the raw-ledger decode cache. Keep existing registration and reconciliation idempotent.
3. In `src/lib/secure-storage.ts`, retain bounded 8192-byte Unicode encoding, indexed byte decoding, existing checksum validation and v1 envelopes. Keep the full IndexedDB durable mirror and quota fallback; avoid duplicate mirror writes.
4. In `src/lib/phi-search-token.ts`, wait 4.5 seconds for idle before starting the latest pending hidden site build. Suppress builds while an editable control has focus or input is recent. Pointer, key and focus events must release existing hidden builder frames.
5. Keep the matching `20261004-history2` runtime asset versions in layout and Star Coin loader. If future changes supersede this version, update the observer contract with reviewed evidence instead of reverting an unrelated release.
6. Run the storage/wallet tests (17 passed at repair), large Unicode/checksum case, cache invalidation/account-switch case, and idle builder timer case. At 412×915, verify a new search, text selection, typing, wallet opening and News navigation with the 230-record sample history.
7. Deploy through the existing GitHub Pages workflow and repeat the browser checks on the deployed site.

Never clear browser storage, create a replacement identity, change balances or alter token ownership as a responsiveness repair. Restore code safeguards while preserving saved research and cloud synchronization.

## Rollback

Revert the repair commit only if it causes a confirmed regression, then rebuild with the existing Pages workflow. The old runtime can read the unchanged storage envelopes. Prefer a minimal correction when later working releases contain unrelated improvements.

The observer reports evidence and this runbook. It does not automatically replace code or claim a behavioral test occurred when it only checked deployed source markers.

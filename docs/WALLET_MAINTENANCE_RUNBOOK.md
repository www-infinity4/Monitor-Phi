# Infinity Wallet Maintenance Runbook

This document is the recovery path for the shared wallet surfaces used by Infinity Phi, Omni Phi and QuantaPhi.

## Purpose

Wallet work must be treated as infrastructure. Feature edits must not silently change token totals, Star Coin rewards, search history, source labels, or the path into Token Workspace.

Monitor Phi Observer is the read-only guard. It verifies the published wallet contracts. Repairs remain explicit, scoped and reversible.

## Canonical responsibilities

### Shared search-token total

The canonical counter runtime is:

- `C13b0/public/unified-token-count.js`
- persistent state: `infinity_unified_token_count_v3`
- canonical token ledger: `c13b0_infinity_token_ledger_v3`

The displayed total must never fall because an older snapshot loads. New unique Infinity, Omni or Quanta searches increment the shared total once.

### Token Workspace history

Token Workspace must merge and deduplicate:

- `c13b0_infinity_token_ledger_v3`
- `infinityPhi:searchTokens:v1`
- `omniPhi:history:v1`
- `omniPhi:pendingInfinitySearches:v1`
- `omniPhi:lastSearchToken:v1`
- `quantaPhiBuildHistoryV1`
- `infinity_unified_wallet_v1` searches/tokens
- StarQuest `infinitySearches` and `infinityLedger`

Recovered history is written back to the canonical ledger. Source metadata must remain Infinity Phi, Omni Phi or QuantaPhi; generic unified-wallet metadata must not overwrite a more specific source.

### Star Coins

Star Coins are a separate reward balance from the shared search-token total.

Rules:

- confirmed share = +0.1 Star Coin
- first collect of a content key = +0.1 Star Coin
- ten tenths roll into one whole Star Coin
- QuantaPhi must award locally first and mirror into StarQuest/unified-wallet state
- Control Phi may render/mirror the reward but must not be the only path that can award it
- reward ledger entries must use idempotent reference IDs so retries do not double-credit

## Observer contract checks

`GET /p/observer/run` checks these published surfaces:

1. QuantaPhi wallet contract — direct collect/share reward functions and shared counter hook exist.
2. Infinity counter contract — canonical keys and register/reconcile functions exist.
3. Omni wallet contract — shared counter and wallet runtime are loaded.
4. Control Phi wallet contract — UI bridge functions exist when that surface is published.

A failed required contract is a release blocker for unrelated wallet edits.

## Before changing any wallet-connected site

1. Read this runbook.
2. Run Monitor Observer.
3. Record the last known-good commit for the site being edited.
4. Do not rename or clear any canonical storage keys.
5. Do not add a second source of truth for the same displayed total.
6. Keep token-count, Token Workspace history and Star Coin rewards as separate concepts.
7. Make the smallest scoped change possible.

## Verification after every change

On one browser/device:

1. Open Infinity Phi, Omni Phi and QuantaPhi and confirm the same shared search-token total.
2. Make one Infinity search: total increases by exactly one and the named search appears in Token Workspace.
3. Make one Omni search: same checks.
4. Make one Quanta search: same checks and source is QuantaPhi/Quant.
5. In QuantaPhi, collect one new card: Star Coin progress increases by exactly 0.1.
6. Share a QuantaPhi card or overview: Star Coin progress increases by exactly 0.1.
7. Repeat the same collect: no second collect credit for the same content key.
8. Open the Star Coin wallet and Token Workspace: the search-token total and source breakdown must not change merely by opening or refreshing either view.
9. Run Monitor Observer again.

## Failure recovery

If a wallet breaks while another feature is being edited:

1. Stop feature work on the affected surface.
2. Identify which invariant failed: total, history, source attribution, or Star Coin reward.
3. Compare the failing file with the last known-good commit.
4. Restore the canonical writer/reader path rather than adding another counter or fallback.
5. Run syntax/tests and publish.
6. Run the full verification list above.
7. Only resume unrelated feature work after Observer passes.

Never repair a wallet by hard-coding a displayed balance. Preserve the underlying ledger and history records.

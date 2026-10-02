const DEFAULT_WALLET_SURFACES = [
  {
    name: "quantaphi-wallet-contract",
    url: "https://www-infinity4.github.io/QuantaPhi/",
    required: [
      "QuantaPhiWallet",
      "addCollect",
      "addShare",
      "starquest_guest_profile_v1",
      "controlPhiWalletButton",
      "unified-token-count.js"
    ]
  },
  {
    name: "infinity-starcoin-menu-contract",
    url: "https://www-infinity4.github.io/C13b0/",
    required: [
      "Star Coin wallet",
      "Unified wallet",
      "Open token workspace"
    ]
  },
  {
    name: "omni-starcoin-runtime-contract",
    url: "https://www-infinity4.github.io/Omni-Phi/assets/app.js",
    required: [
      "awardStarCoinCredit",
      "awardStarCoinShare",
      "starquest_guest_profile_v1",
      "Star Coin wallet",
      "data-show-star-wallet"
    ]
  },
  {
    name: "infinity-token-count-contract",
    url: "https://www-infinity4.github.io/C13b0/unified-token-count.js",
    required: [
      "infinity_unified_token_count_v3",
      "c13b0_infinity_token_ledger_v3",
      "InfinityTokenCount",
      "register",
      "reconcile"
    ]
  },
  {
    name: "omni-wallet-contract",
    url: "https://www-infinity4.github.io/Omni-Phi/",
    required: [
      "unified-token-count.js",
      "assets/app.js",
      "control-phi.js"
    ]
  },
  {
    name: "control-phi-wallet-contract",
    url: "https://www-infinity4.github.io/Control-Phi/control-phi.js",
    required: [
      "ensureActionCredit",
      "refreshWalletUI",
      "starquest_guest_profile_v1",
      "infinity_unified_wallet_v1"
    ],
    optional: true
  }
];

export function createWalletContractChecks({
  fetchImpl = globalThis.fetch,
  surfaces = DEFAULT_WALLET_SURFACES,
  timeoutMs = 7000
} = {}) {
  return surfaces.map(surface => ({
    name: surface.name,
    async run() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(surface.url, {
          cache: "no-store",
          signal: controller.signal,
          headers: { "accept": "text/html,application/javascript,text/plain,*/*" }
        });
        const text = await response.text();
        const missing = surface.required.filter(marker => !text.includes(marker));
        const ok = response.ok && missing.length === 0;
        return {
          ok: surface.optional ? true : ok,
          contractOk: ok,
          optional: Boolean(surface.optional),
          url: surface.url,
          status: response.status,
          missing,
          required: surface.required,
          remediation: ok
            ? "none"
            : "Follow docs/WALLET_MAINTENANCE_RUNBOOK.md. Restore the last known-good wallet contract before unrelated feature work."
        };
      } catch (error) {
        return {
          ok: Boolean(surface.optional),
          contractOk: false,
          optional: Boolean(surface.optional),
          url: surface.url,
          error: String(error?.message || error),
          remediation: "Follow docs/WALLET_MAINTENANCE_RUNBOOK.md and verify the published asset plus its repository source."
        };
      } finally {
        clearTimeout(timer);
      }
    }
  }));
}

export { DEFAULT_WALLET_SURFACES };

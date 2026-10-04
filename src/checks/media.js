const SURFACES = [
  ["QuantaPhi/media-repair.js", ["QuantaMediaRepair","qImagesBtn","qVideoBtn","qSoundBtn","quanta-overview-first-v2"]],
  ["QuantaPhi/", ["quantaAiUserId","gpt-overview-writer","id=\"overview\""]],
  ["Omni-Phi/images/", ["image-search-v4.js"]],
  ["Omni-Phi/video/", ["assets/app.js"]],
  ["Omni-Phi/audio/", ["assets/app.js"]],
  ["C13b0/phi/images/", ["Infinity"]],
  ["C13b0/phi/video/", ["Infinity"]],
  ["C13b0/phi/sound/", ["Infinity"]],
  ["News-Phi/monitor-refresh-loop.js", ["NewsPhiDirect","categories:'news'","windowDays:7","newsphi:monitor-feed"]],
  ["https://infinity-rogers.marvaseater.workers.dev/health", ["infinity-ai-gateway","\"openaiConfigured\":true","\"workersAIConfigured\":true"]]
];

export function createMediaChecks({ fetchImpl = globalThis.fetch, base = "https://www-infinity4.github.io/", timeoutMs = 8000 } = {}) {
  return SURFACES.map(([path, required]) => ({
    name: "media:" + path,
    async run() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const target = /^https?:\/\//i.test(path) ? path : new URL(path, base);
        const response = await fetchImpl(target, { cache: "no-store", signal: controller.signal });
        const body = await response.text();
        const missing = required.filter(marker => !body.includes(marker));
        return { ok: response.ok && missing.length === 0, status: response.status, path, missing };
      } catch (error) {
        return { ok: false, path, error: String(error?.message || error) };
      } finally {
        clearTimeout(timer);
      }
    }
  }));
}

export { SURFACES as MEDIA_SURFACES };

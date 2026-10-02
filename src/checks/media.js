const SURFACES = [
  ["QuantaPhi/media-repair.js", ["QuantaMediaRepair","qImagesBtn","qVideoBtn","qSoundBtn","quanta-overview-first-v1"]],
  ["QuantaPhi/", ["quantaAiUserId","gpt-overview-writer","id=\"overview\""]],
  ["Omni-Phi/images/", ["image-search-v4.js"]],
  ["Omni-Phi/video/", ["assets/app.js"]],
  ["Omni-Phi/audio/", ["assets/app.js"]],
  ["C13b0/phi/images/", ["Infinity"]],
  ["C13b0/phi/video/", ["Infinity"]],
  ["C13b0/phi/sound/", ["Infinity"]]
];

export function createMediaChecks({ fetchImpl = globalThis.fetch, base = "https://www-infinity4.github.io/", timeoutMs = 8000 } = {}) {
  return SURFACES.map(([path, required]) => ({
    name: "media:" + path,
    async run() {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(new URL(path, base), { cache: "no-store", signal: controller.signal });
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

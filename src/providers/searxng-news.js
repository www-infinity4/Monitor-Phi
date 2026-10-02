const clean = value => String(value ?? "").replace(/\s+/g, " ").trim();

export function createSearxngNewsProvider({ endpoint, fetchImpl = fetch, perSeed = 5 } = {}) {
  const base = clean(endpoint).replace(/\/$/, "");
  if (!base) throw new TypeError("SearXNG endpoint is required");

  return async function searxngNewsProvider({ seeds }) {
    const jobs = seeds.slice(0, 12).map(async seed => {
      const query = clean(seed.topic);
      if (!query) return [];
      const params = new URLSearchParams({
        q: query,
        format: "json",
        categories: "news",
        time_range: "week",
        _newsphi: String(Date.now())
      });
      const response = await fetchImpl(`${base}/search?${params}`, {
        cache: "no-store",
        headers: { accept: "application/json", "cache-control": "no-cache" }
      });
      if (!response.ok) return [];
      const data = await response.json();
      return (data?.results || []).slice(0, perSeed).map(item => ({
        title: clean(item.title),
        url: clean(item.url),
        excerpt: clean(item.content || item.snippet),
        image: clean(item.img_src || item.thumbnail),
        source: clean(item.engine || item.source || "Web result"),
        publishedAt: clean(item.publishedDate || item.published_at),
        topic: seed.topic
      }));
    });
    return (await Promise.all(jobs)).flat();
  };
}

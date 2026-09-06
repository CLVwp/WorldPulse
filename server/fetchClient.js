// Client HTTP minimal (fetch natif, aucune dépendance) avec timeout et retries.
const DEFAULT_TIMEOUT = 12_000;

export async function fetchWithTimeout(url, { timeoutMs = DEFAULT_TIMEOUT, headers = {}, retries = 2, browserUa = false } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const ua = browserUa
        ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
        : "WorldPulse/0.1 (news map MVP)";
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": ua,
          "Accept": "application/rss+xml, application/xml, application/json;q=0.9, */*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
          ...headers,
        },
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      lastError = err;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

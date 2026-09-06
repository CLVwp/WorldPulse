// Client HTTP minimal : timeout via AbortSignal.timeout (Node ≥17.3), pas de retry —
// le refresh toutes les 90 s est déjà le retry.
export async function fetchWithTimeout(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    redirect: "follow",
    headers: {
      "User-Agent": "WorldPulse/0.1 (news map MVP)",
      "Accept": "application/rss+xml, application/xml, application/json;q=0.9, */*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

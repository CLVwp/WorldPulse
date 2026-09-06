// Parseur JSON Reddit (endpoint .json public, pas d'auth nécessaire).

export function parseReddit(jsonText, sourceMeta) {
  let data;
  try {
    data = JSON.parse(jsonText);
  } catch {
    return [];
  }
  const children = data?.data?.children ?? [];
  const out = [];
  for (const { data: post } of children) {
    if (!post?.title) continue;
    out.push({
      id: `${sourceMeta.id}:${post.id}`,
      title: String(post.title).trim(),
      url: post.url_overridden_by_dest || `https://www.reddit.com${post.permalink}`,
      source: sourceMeta.name,
      sourceId: sourceMeta.id,
      sourceType: "reddit",
      lang: sourceMeta.lang,
      publishedAt: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : null,
      description: post.selftext ? String(post.selftext).slice(0, 300) : null,
      score: post.score ?? 0,
    });
  }
  return out;
}

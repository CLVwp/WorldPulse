// Parseur RSS minimal avec fast-xml-parser.
import { XMLParser } from "fast-xml-parser";

// processEntities: false → contourne la limite anti-XXE (les flux des grands médias
// contiennent souvent > 1000 entités). On décode manuellement les entités courantes.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: false,
});

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", eacute: "é", egrave: "è", ecirc: "ê", agrave: "à", ccedil: "ç", ugrave: "ù", ocirc: "ô", icirc: "î", acirc: "â", ucirc: "û", laquo: "«", raquo: "»", rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”", mdash: "—", ndash: "–", hellip: "…" };

function decodeEntities(s) {
  return String(s).replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, code) => {
    if (code[0] === "#") {
      const num = code[1] === "x" || code[1] === "X" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(num) ? String.fromCodePoint(num) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

function pickTitle(item, lang) {
  if (lang === "fr") return item["title"] ?? item["fr:title"] ?? null;
  return item.title ?? null;
}

export function parseRss(xmlText, sourceMeta) {
  const doc = parser.parse(xmlText);
  const channel = doc?.rss?.channel ?? doc?.["rdf:RDF"]?.channel ?? doc?.feed;
  if (!channel) return [];

  const rawItems = channel.item ?? channel.entry ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  const out = [];
  for (const item of items) {
    const title = pickTitle(item, sourceMeta.lang);
    if (!title) continue;

    const link = item.link?.["@_href"] ?? (typeof item.link === "string" ? item.link : item.link ?? null);
    const pubRaw = item.pubDate ?? item.published ?? item["dc:date"] ?? item.updated ?? null;
    const description = typeof item.description === "string"
      ? item.description
      : typeof item.summary === "string" ? item.summary : null;

    out.push({
      id: `${sourceMeta.id}:${hashString(link ?? title)}`,
      title: decodeEntities(String(title).trim()),
      url: link ?? null,
      source: sourceMeta.name,
      sourceId: sourceMeta.id,
      sourceType: "rss",
      lang: sourceMeta.lang,
      publishedAt: pubRaw ? new Date(pubRaw).toISOString() : null,
      description: description ? stripHtml(decodeEntities(description)).slice(0, 300) : null,
    });
  }
  return out;
}

function stripHtml(s) {
  return s.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

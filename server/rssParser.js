// Parseur RSS minimal avec fast-xml-parser.
import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";

// ponytail: processEntities:false + mini-décodeur — fast-xml-parser plante (>1000
// entités) sur les gros flux type Guardian même pour les entités HTML standard.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: false,
});

const ENT_MAP = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decodeEntities = (s) => String(s)
  .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&([a-z]+);/gi, (m, name) => ENT_MAP[name.toLowerCase()] ?? m);

// Certains flux (Google News, Times of India) embarquent du HTML échappé dans les
// titres et descriptions : décoder d'abord (&lt;img...&gt; → <img...>), puis retirer
// les balises. L'ordre inverse laisserait le contenu des balises dans le texte.
const cleanText = (s) => stripHtml(decodeEntities(s));

export function parseRss(xmlText, sourceMeta) {
  const doc = parser.parse(xmlText);
  const channel = doc?.rss?.channel ?? doc?.["rdf:RDF"]?.channel ?? doc?.feed;
  if (!channel) return [];

  const rawItems = channel.item ?? channel.entry ?? [];
  const items = Array.isArray(rawItems) ? rawItems : [rawItems];

  const out = [];
  for (const item of items) {
    const title = item.title ?? null;
    if (!title) continue;

    const link = item.link?.["@_href"] ?? (typeof item.link === "string" ? item.link : item.link ?? null);
    const pubRaw = item.pubDate ?? item.published ?? item["dc:date"] ?? item.updated ?? null;
    const description = typeof item.description === "string"
      ? item.description
      : typeof item.summary === "string" ? item.summary : null;

    out.push({
      id: `${sourceMeta.id}:${hashString(link ?? title)}`,
      title: cleanText(String(title)),
      url: link ?? null,
      source: sourceMeta.name,
      sourceId: sourceMeta.id,
      sourceType: "rss",
      lang: sourceMeta.lang,
      publishedAt: pubRaw ? new Date(pubRaw).toISOString() : null,
      description: description ? cleanText(description).slice(0, 300) : null,
    });
  }
  return out;
}

function stripHtml(s) {
  return s.replace(/<[^>]*>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function hashString(str) {
  return createHash("md5").update(str).digest("hex").slice(0, 8);
}

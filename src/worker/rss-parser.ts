// Parseur RSS minimal avec fast-xml-parser.
import { XMLParser } from "fast-xml-parser";
import type { SourceMeta } from "./sources";

// ponytail: processEntities:false + mini-décodeur — fast-xml-parser plante (>1000
// entités) sur les gros flux type Guardian même pour les entités HTML standard.
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: false,
});

const ENT_MAP: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
const decodeEntities = (s: string): string =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) =>
      String.fromCodePoint(Number.parseInt(n, 16)),
    )
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(
      /&([a-z]+);/gi,
      (m: string, name: string) => ENT_MAP[name.toLowerCase()] ?? m,
    );

// Certains flux (Google News, Times of India) embarquent du HTML échappé dans les
// titres et descriptions : décoder d'abord (&lt;img...&gt; → <img...>), puis retirer
// les balises. L'ordre inverse laisserait le contenu des balises dans le texte.
const cleanText = (s: string): string => stripHtml(decodeEntities(s));

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// djb2 : hash d'id court, stable, sans dépendance node:crypto.
function hashString(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++)
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0");
}

/** Item RSS brut enrichi minimal (avant géolocalisation par l'agrégateur). */
export interface RssItem {
  id: string;
  title: string;
  url: string | null;
  source: string;
  sourceId: string;
  lang: "en" | "fr";
  publishedAt: string | null;
  description: string | null;
}

type XmlNode = Record<string, unknown>;

const str = (v: unknown): string | null => {
  if (typeof v === "string" && v.trim()) return v;
  if (typeof v === "number") return String(v);
  return null;
};

const asArray = <T>(v: T | T[] | undefined): T[] =>
  Array.isArray(v) ? v : v ? [v] : [];

function linkOf(item: XmlNode): string | null {
  const link = item["link"];
  if (link && typeof link === "object" && link !== null) {
    return str((link as XmlNode)["@_href"]);
  }
  return str(link);
}

export function parseRss(xmlText: string, sourceMeta: SourceMeta): RssItem[] {
  const doc = parser.parse(xmlText) as XmlNode;
  const channel = ((doc["rss"] as XmlNode | undefined)?.["channel"] ??
    (doc["rdf:RDF"] as XmlNode | undefined)?.["channel"] ??
    doc["feed"]) as XmlNode | undefined;
  if (!channel) return [];

  const out: RssItem[] = [];
  for (const item of asArray(
    channel["item"] as XmlNode | XmlNode[] | undefined,
  ).concat(asArray(channel["entry"] as XmlNode | XmlNode[] | undefined))) {
    const title = str(item["title"]);
    if (!title) continue;

    const pubRaw =
      str(item["pubDate"]) ??
      str(item["published"]) ??
      str(item["dc:date"]) ??
      str(item["updated"]);
    const description = str(item["description"]) ?? str(item["summary"]);

    out.push({
      id: `${sourceMeta.id}:${hashString(linkOf(item) ?? title)}`,
      title: cleanText(title),
      url: linkOf(item),
      source: sourceMeta.name,
      sourceId: sourceMeta.id,
      lang: sourceMeta.lang,
      publishedAt: pubRaw ? new Date(pubRaw).toISOString() : null,
      description: description ? cleanText(description).slice(0, 300) : null,
    });
  }
  return out;
}

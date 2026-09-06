// Sources d'actualité : flux RSS gratuits + Reddit JSON public (pas de clés API).
// Chaque source déclare une langue pour prioriser le bon titre.

export const RSS_SOURCES = [
  { id: "bbc-world", name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", lang: "en" },
  { id: "aljazeera", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", lang: "en" },
  { id: "france24", name: "France 24", url: "https://www.france24.com/fr/rss", lang: "fr" },
  { id: "lemonde", name: "Le Monde", url: "https://www.lemonde.fr/rss/une.xml", lang: "fr" },
  { id: "reuters-vertex", name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml", lang: "en" },
  { id: "dw-world", name: "DW", url: "https://rss.dw.com/rdf/rss-en-world", lang: "en" },
  { id: "euronews", name: "Euronews", url: "https://www.euronews.com/rss", lang: "en" },
  { id: "guardian-world", name: "The Guardian", url: "https://www.theguardian.com/world/rss", lang: "en" },
];

// Subreddits d'actualité : désactivés — Reddit bloque les clients non-navigateurs (403
// quel que soit le User-Agent, fingerprint TLS détecté). À réactiver via un proxy
// dédié ou une clé API Reddit officielle le cas échéant.
export const REDDIT_SOURCES = [];

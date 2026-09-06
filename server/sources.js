// Sources d'actualité : flux RSS gratuits + Reddit JSON public (pas de clés API).
// Chaque source déclare une langue pour prioriser le bon titre.

export const RSS_SOURCES = [
  { id: "bbc-world", name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml", lang: "en" },
  { id: "aljazeera", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml", lang: "en" },
  { id: "france24", name: "France 24", url: "https://www.france24.com/fr/rss", lang: "fr" },
  { id: "lemonde", name: "Le Monde", url: "https://www.lemonde.fr/rss/une.xml", lang: "fr" },
  { id: "npr-world", name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml", lang: "en" },
  { id: "dw-world", name: "DW", url: "https://rss.dw.com/rdf/rss-en-world", lang: "en" },
  { id: "euronews", name: "Euronews", url: "https://www.euronews.com/rss", lang: "en" },
  { id: "guardian-world", name: "The Guardian", url: "https://www.theguardian.com/world/rss", lang: "en" },
  { id: "reuters-world", name: "Reuters", url: "https://news.google.com/rss/search?q=site:reuters.com+when:2d&hl=en-US&gl=US&ceid=US:en", lang: "en" },
  { id: "bloomberg", name: "Bloomberg", url: "https://feeds.bloomberg.com/markets/news.rss", lang: "en" },
  { id: "cnbc-world", name: "CNBC", url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362", lang: "en" },
  { id: "yahoo-world", name: "Yahoo News", url: "https://news.yahoo.com/rss/world", lang: "en" },
  { id: "lefigaro-monde", name: "Le Figaro", url: "https://www.lefigaro.fr/rss/figaro_actualites.xml", lang: "fr" },
  { id: "latimes-world", name: "LA Times", url: "https://www.latimes.com/world-nation/rss2.0.xml", lang: "en" },
  { id: "scmp-news", name: "SCMP", url: "https://www.scmp.com/rss/91/feed", lang: "en" },
  { id: "timesofindia", name: "Times of India", url: "https://timesofindia.indiatimes.com/rssfeeds/296589292.cms", lang: "en" },
];

// Subreddits d'actualité : désactivés — Reddit bloque les clients non-navigateurs (403).
// Réactivation possible via API Reddit officielle (OAuth).

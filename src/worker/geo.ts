// Correspondance mots-clés (titres FR/EN) -> pays + coordonnées du centroïde.
// MVP : liste volontairement resserrée mais couvrant l'actualité mondiale.
// Chaque entrée : liste d'alias (insensible à la casse, comparés comme mots entiers).

export interface CountryInfo {
  name: string;
  aliases: string[];
  lat: number;
  lng: number;
}

const COUNTRIES: Record<string, CountryInfo> = {
  FR: {
    name: "France",
    aliases: ["france", "french", "paris", "macron", "lyon", "marseille"],
    lat: 46.6,
    lng: 2.4,
  },
  GB: {
    name: "Royaume-Uni",
    aliases: [
      "uk",
      "britain",
      "british",
      "england",
      "scotland",
      "wales",
      "london",
      "westminster",
    ],
    lat: 54.0,
    lng: -2.5,
  },
  DE: {
    name: "Allemagne",
    aliases: ["germany", "german", "berlin", "deutschland", "merkel"],
    lat: 51.1,
    lng: 10.4,
  },
  IT: {
    name: "Italie",
    aliases: ["italy", "italian", "rome", "roma"],
    lat: 42.8,
    lng: 12.5,
  },
  ES: {
    name: "Espagne",
    aliases: ["spain", "spanish", "madrid", "barcelona"],
    lat: 40.2,
    lng: -3.7,
  },
  PT: {
    name: "Portugal",
    aliases: ["portugal", "lisbon", "lisboa"],
    lat: 39.6,
    lng: -8.0,
  },
  BE: {
    name: "Belgique",
    aliases: ["belgium", "brussels", "bruxelles"],
    lat: 50.6,
    lng: 4.5,
  },
  NL: {
    name: "Pays-Bas",
    aliases: ["netherlands", "dutch", "amsterdam"],
    lat: 52.2,
    lng: 5.5,
  },
  CH: {
    name: "Suisse",
    aliases: ["switzerland", "swiss", "geneva", "geneve", "davos"],
    lat: 46.8,
    lng: 8.2,
  },
  AT: {
    name: "Autriche",
    aliases: ["austria", "vienna", "vienne"],
    lat: 47.6,
    lng: 14.1,
  },
  SE: {
    name: "Suède",
    aliases: ["sweden", "swedish", "stockholm"],
    lat: 62.0,
    lng: 15.0,
  },
  NO: { name: "Norvège", aliases: ["norway", "oslo"], lat: 61.0, lng: 9.0 },
  DK: {
    name: "Danemark",
    aliases: ["denmark", "danish", "copenhagen"],
    lat: 56.0,
    lng: 10.0,
  },
  FI: {
    name: "Finlande",
    aliases: ["finland", "helsinki"],
    lat: 63.0,
    lng: 26.0,
  },
  PL: {
    name: "Pologne",
    aliases: ["poland", "polish", "warsaw", "varsovie"],
    lat: 52.0,
    lng: 19.3,
  },
  UA: {
    name: "Ukraine",
    aliases: ["ukraine", "ukrainian", "kyiv", "kiev", "zelensky"],
    lat: 49.0,
    lng: 31.5,
  },
  RU: {
    name: "Russie",
    aliases: ["russia", "russian", "moscow", "moscou", "putin", "kremlin"],
    lat: 58.0,
    lng: 60.0,
  },
  BY: {
    name: "Bélarus",
    aliases: ["belarus", "lukashenko"],
    lat: 53.7,
    lng: 27.9,
  },
  TR: {
    name: "Turquie",
    aliases: ["turkey", "turkish", "türkiye", "ankara", "istanbul", "erdogan"],
    lat: 39.0,
    lng: 35.0,
  },
  GR: {
    name: "Grèce",
    aliases: ["greece", "greek", "athens", "athenes"],
    lat: 39.0,
    lng: 22.0,
  },
  SY: {
    name: "Syrie",
    aliases: ["syria", "syrian", "damascus", "damas", "aleppo"],
    lat: 35.0,
    lng: 38.5,
  },
  IQ: {
    name: "Irak",
    aliases: ["iraq", "iraqi", "baghdad", "bagdad"],
    lat: 33.2,
    lng: 43.7,
  },
  IR: {
    name: "Iran",
    aliases: ["iran", "iranian", "tehran", "téhéran"],
    lat: 32.4,
    lng: 53.7,
  },
  IL: {
    name: "Israël",
    aliases: ["israel", "israeli", "jerusalem", "jérusalem", "tel aviv"],
    lat: 31.4,
    lng: 34.9,
  },
  PS: {
    name: "Palestine",
    aliases: [
      "palestine",
      "palestinian",
      "gaza",
      "west bank",
      "cisjordanie",
      "hamas",
    ],
    lat: 31.9,
    lng: 35.2,
  },
  LB: {
    name: "Liban",
    aliases: ["lebanon", "lebanese", "beirut", "beyrouth", "hezbollah"],
    lat: 33.9,
    lng: 35.5,
  },
  SA: {
    name: "Arabie saoudite",
    aliases: ["saudi", "riyadh"],
    lat: 24.0,
    lng: 45.0,
  },
  AE: {
    name: "Émirats arabes unis",
    aliases: ["emirates", "uae", "dubai", "abu dhabi"],
    lat: 24.0,
    lng: 54.0,
  },
  YE: {
    name: "Yémen",
    aliases: ["yemen", "houthi", "sanaa"],
    lat: 15.5,
    lng: 48.2,
  },
  EG: {
    name: "Égypte",
    aliases: ["egypt", "egyptian", "cairo", "le caire"],
    lat: 26.8,
    lng: 30.8,
  },
  LY: {
    name: "Libye",
    aliases: ["libya", "libyan", "tripoli"],
    lat: 26.3,
    lng: 17.2,
  },
  TN: {
    name: "Tunisie",
    aliases: ["tunisia", "tunisian", "tunis"],
    lat: 34.0,
    lng: 9.5,
  },
  DZ: {
    name: "Algérie",
    aliases: ["algeria", "algerian", "algiers", "alger"],
    lat: 28.0,
    lng: 2.6,
  },
  MA: {
    name: "Maroc",
    aliases: ["morocco", "moroccan", "rabat", "marrakech"],
    lat: 31.8,
    lng: -7.1,
  },
  SD: {
    name: "Soudan",
    aliases: ["sudan", "khartoum", "darfur"],
    lat: 15.6,
    lng: 30.2,
  },
  ET: {
    name: "Éthiopie",
    aliases: ["ethiopia", "ethiopian", "addis ababa", "tigray"],
    lat: 9.1,
    lng: 40.5,
  },
  SO: {
    name: "Somalie",
    aliases: ["somalia", "somali", "mogadishu"],
    lat: 5.2,
    lng: 46.2,
  },
  KE: {
    name: "Kenya",
    aliases: ["kenya", "kenyan", "nairobi"],
    lat: 0.2,
    lng: 37.9,
  },
  NG: {
    name: "Nigéria",
    aliases: ["nigeria", "nigerian", "lagos", "abuja"],
    lat: 9.1,
    lng: 8.7,
  },
  ZA: {
    name: "Afrique du Sud",
    aliases: ["south africa", "johannesburg", "cape town", "pretoria"],
    lat: -29.0,
    lng: 24.7,
  },
  CM: {
    name: "Cameroun",
    aliases: ["cameroon", "yaounde", "yaoundé"],
    lat: 5.7,
    lng: 12.7,
  },
  CD: {
    name: "RD Congo",
    aliases: ["congo", "kinshasa", "goma"],
    lat: -2.9,
    lng: 23.6,
  },
  ML: { name: "Mali", aliases: ["mali", "bamako"], lat: 17.6, lng: -4.0 },
  HT: {
    name: "Haïti",
    aliases: ["haiti", "port-au-prince"],
    lat: 19.0,
    lng: -72.4,
  },
  US: {
    name: "États-Unis",
    aliases: [
      "usa",
      "united states",
      "us ",
      "washington",
      "america",
      "american",
      "new york",
      "trump",
      "biden",
      "white house",
      "california",
      "texas",
      "florida",
    ],
    lat: 39.8,
    lng: -98.6,
  },
  CA: {
    name: "Canada",
    aliases: ["canada", "canadian", "ottawa", "quebec", "québec", "toronto"],
    lat: 56.1,
    lng: -106.3,
  },
  MX: {
    name: "Mexique",
    aliases: ["mexico", "mexican", "mexique"],
    lat: 23.6,
    lng: -102.5,
  },
  BR: {
    name: "Brésil",
    aliases: [
      "brazil",
      "brazilian",
      "brasilia",
      "rio de janeiro",
      "sao paulo",
      "lula",
    ],
    lat: -14.2,
    lng: -51.9,
  },
  AR: {
    name: "Argentine",
    aliases: ["argentina", "argentine", "buenos aires", "milei"],
    lat: -38.4,
    lng: -63.6,
  },
  CL: {
    name: "Chili",
    aliases: ["chile", "chilean", "santiago"],
    lat: -35.7,
    lng: -71.5,
  },
  CO: {
    name: "Colombie",
    aliases: ["colombia", "colombian", "bogota", "bogotá"],
    lat: 4.6,
    lng: -74.3,
  },
  PE: { name: "Pérou", aliases: ["peru", "lima"], lat: -9.2, lng: -75.0 },
  VE: {
    name: "Venezuela",
    aliases: ["venezuela", "caracas", "maduro"],
    lat: 6.4,
    lng: -66.6,
  },
  CN: {
    name: "Chine",
    aliases: [
      "china",
      "chinese",
      "beijing",
      "pekin",
      "pékin",
      "shanghai",
      "xi jinping",
    ],
    lat: 35.9,
    lng: 104.2,
  },
  JP: {
    name: "Japon",
    aliases: ["japan", "japanese", "tokyo"],
    lat: 36.2,
    lng: 138.3,
  },
  KP: {
    name: "Corée du Nord",
    aliases: ["north korea", "pyongyang", "kim jong"],
    lat: 40.3,
    lng: 127.5,
  },
  KR: {
    name: "Corée du Sud",
    aliases: ["south korea", "seoul", "korean"],
    lat: 36.5,
    lng: 127.9,
  },
  IN: {
    name: "Inde",
    aliases: ["india", "indian", "delhi", "mumbai", "modi"],
    lat: 20.6,
    lng: 78.9,
  },
  PK: {
    name: "Pakistan",
    aliases: ["pakistan", "pakistani", "islamabad", "karachi"],
    lat: 30.4,
    lng: 69.3,
  },
  AF: {
    name: "Afghanistan",
    aliases: ["afghanistan", "afghan", "kabul", "taliban"],
    lat: 33.9,
    lng: 67.7,
  },
  ID: {
    name: "Indonésie",
    aliases: ["indonesia", "indonesian", "jakarta", "bali"],
    lat: -0.8,
    lng: 113.9,
  },
  AU: {
    name: "Australie",
    aliases: ["australia", "australian", "sydney", "canberra", "melbourne"],
    lat: -25.3,
    lng: 133.8,
  },
  NZ: {
    name: "Nouvelle-Zélande",
    aliases: ["new zealand", "wellington", "auckland"],
    lat: -40.9,
    lng: 174.9,
  },
  TW: { name: "Taïwan", aliases: ["taiwan", "taipei"], lat: 23.7, lng: 121.0 },
  MM: {
    name: "Birmanie",
    aliases: ["myanmar", "burma", "yangon"],
    lat: 19.8,
    lng: 96.1,
  },
  TH: {
    name: "Thaïlande",
    aliases: ["thailand", "thai", "bangkok"],
    lat: 15.9,
    lng: 101.0,
  },
  VN: {
    name: "Viêt Nam",
    aliases: ["vietnam", "viet nam", "hanoi"],
    lat: 14.1,
    lng: 108.3,
  },
  PH: {
    name: "Philippines",
    aliases: ["philippines", "manila", "manille"],
    lat: 12.9,
    lng: 121.8,
  },
  SG: {
    name: "Singapour",
    aliases: ["singapore", "singapour"],
    lat: 1.35,
    lng: 103.8,
  },
};

const ALIAS_INDEX: { code: string; alias: string }[] = [];
for (const [code, c] of Object.entries(COUNTRIES)) {
  for (const alias of c.aliases)
    ALIAS_INDEX.push({ code, alias: alias.toLowerCase() });
}
// Tri par longueur décroissante : "north korea" avant "korea", "south africa" avant "africa"…
ALIAS_INDEX.sort((a, b) => b.alias.length - a.alias.length);

// Index de villes : permet de positionner précisément un event quand on zoome.
// [alias, lat, lng, codePays]
const CITIES: [string, number, number, string][] = [
  ["paris", 48.86, 2.35, "FR"],
  ["lyon", 45.76, 4.84, "FR"],
  ["marseille", 43.3, 5.37, "FR"],
  ["london", 51.51, -0.13, "GB"],
  ["londres", 51.51, -0.13, "GB"],
  ["manchester", 53.48, -2.24, "GB"],
  ["edinburgh", 55.95, -3.19, "GB"],
  ["berlin", 52.52, 13.4, "DE"],
  ["munich", 48.14, 11.58, "DE"],
  ["hamburg", 53.55, 9.99, "DE"],
  ["rome", 41.9, 12.5, "IT"],
  ["roma", 41.9, 12.5, "IT"],
  ["milan", 45.46, 9.19, "IT"],
  ["naples", 40.85, 14.27, "IT"],
  ["madrid", 40.42, -3.7, "ES"],
  ["barcelona", 41.39, 2.17, "ES"],
  ["lisbon", 38.72, -9.14, "PT"],
  ["lisboa", 38.72, -9.14, "PT"],
  ["brussels", 50.85, 4.35, "BE"],
  ["bruxelles", 50.85, 4.35, "BE"],
  ["amsterdam", 52.37, 4.9, "NL"],
  ["vienna", 48.21, 16.37, "AT"],
  ["vienne", 48.21, 16.37, "AT"],
  ["stockholm", 59.33, 18.07, "SE"],
  ["oslo", 59.91, 10.75, "NO"],
  ["copenhagen", 55.68, 12.57, "DK"],
  ["helsinki", 60.17, 24.94, "FI"],
  ["warsaw", 52.23, 21.01, "PL"],
  ["varsovie", 52.23, 21.01, "PL"],
  ["kyiv", 50.45, 30.52, "UA"],
  ["kiev", 50.45, 30.52, "UA"],
  ["moscow", 55.76, 37.62, "RU"],
  ["moscou", 55.76, 37.62, "RU"],
  ["istanbul", 41.01, 28.98, "TR"],
  ["ankara", 39.93, 32.86, "TR"],
  ["athens", 37.98, 23.73, "GR"],
  ["damascus", 33.51, 36.29, "SY"],
  ["damas", 33.51, 36.29, "SY"],
  ["aleppo", 36.2, 37.13, "SY"],
  ["baghdad", 33.31, 44.36, "IQ"],
  ["bagdad", 33.31, 44.36, "IQ"],
  ["tehran", 35.69, 51.39, "IR"],
  ["jerusalem", 31.78, 35.22, "IL"],
  ["tel aviv", 32.08, 34.78, "IL"],
  ["gaza", 31.5, 34.47, "PS"],
  ["beirut", 33.89, 35.5, "LB"],
  ["beyrouth", 33.89, 35.5, "LB"],
  ["cairo", 30.04, 31.24, "EG"],
  ["tripoli", 32.89, 13.19, "LY"],
  ["tunis", 36.81, 10.18, "TN"],
  ["algiers", 36.75, 3.06, "DZ"],
  ["rabat", 34.02, -6.84, "MA"],
  ["khartoum", 15.5, 32.56, "SD"],
  ["addis ababa", 9.03, 38.74, "ET"],
  ["mogadishu", 2.05, 45.32, "SO"],
  ["nairobi", -1.29, 36.82, "KE"],
  ["lagos", 6.52, 3.38, "NG"],
  ["johannesburg", -26.2, 28.05, "ZA"],
  ["cape town", -33.92, 18.42, "ZA"],
  ["kinshasa", -4.44, 15.27, "CD"],
  ["bamako", 12.65, -8.0, "ML"],
  ["washington", 38.9, -77.04, "US"],
  ["new york", 40.71, -74.01, "US"],
  ["los angeles", 34.05, -118.24, "US"],
  ["chicago", 41.88, -87.63, "US"],
  ["houston", 29.76, -95.37, "US"],
  ["miami", 25.76, -80.19, "US"],
  ["ottawa", 45.42, -75.7, "CA"],
  ["toronto", 43.65, -79.38, "CA"],
  ["mexico city", 19.43, -99.13, "MX"],
  ["brasilia", -15.79, -47.88, "BR"],
  ["rio de janeiro", -22.91, -43.17, "BR"],
  ["sao paulo", -23.55, -46.63, "BR"],
  ["buenos aires", -34.6, -58.38, "AR"],
  ["santiago", -33.45, -70.67, "CL"],
  ["bogota", 4.71, -74.07, "CO"],
  ["caracas", 10.48, -66.9, "VE"],
  ["beijing", 39.9, 116.4, "CN"],
  ["pekin", 39.9, 116.4, "CN"],
  ["shanghai", 31.23, 121.47, "CN"],
  ["hong kong", 22.32, 114.17, "CN"],
  ["tokyo", 35.68, 139.69, "JP"],
  ["seoul", 37.57, 126.98, "KR"],
  ["pyongyang", 39.04, 125.76, "KP"],
  ["delhi", 28.61, 77.21, "IN"],
  ["mumbai", 19.08, 72.88, "IN"],
  ["islamabad", 33.68, 73.05, "PK"],
  ["kabul", 34.53, 69.17, "AF"],
  ["jakarta", -6.21, 106.85, "ID"],
  ["taipei", 25.03, 121.57, "TW"],
  ["bangkok", 13.76, 100.5, "TH"],
  ["manila", 14.6, 120.98, "PH"],
  ["singapore", 1.35, 103.82, "SG"],
  ["sydney", -33.87, 151.21, "AU"],
  ["melbourne", -37.81, 144.96, "AU"],
  ["auckland", -36.85, 174.76, "NZ"],
];

const CITY_INDEX = CITIES.map(([alias, lat, lng, code]) => ({
  alias,
  lat,
  lng,
  code,
})).sort((a, b) => b.alias.length - a.alias.length);

export interface CityHit {
  lat: number;
  lng: number;
  countryCode: string;
}

/** Détecte le pays le plus probable dans un texte (titre + résumé). */
export function detectCountry(text: string): string | null {
  const t = ` ${text.toLowerCase()} `;
  for (const { code, alias } of ALIAS_INDEX) {
    if (t.includes(alias)) return code;
  }
  return null;
}

/** Détecte une ville mentionnée dans le texte pour un positionnement précis. */
export function detectCity(text: string): CityHit | null {
  const t = ` ${text.toLowerCase()} `;
  for (const { alias, lat, lng, code } of CITY_INDEX) {
    if (t.includes(alias)) return { lat, lng, countryCode: code };
  }
  return null;
}

export function getCountry(code: string): CountryInfo | null {
  return COUNTRIES[code] ?? null;
}

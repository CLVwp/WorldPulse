# WorldPulse 🌍

MVP d'une **fonderie de données OSINT temps réel** : une carte du monde dark mode où chaque événement apparaît comme une pulsation animée. Deux familles de sources, un format d'event unifié :

- **NEWS** — 16 sources de presse géolocalisées (BBC, Al Jazeera, France 24, Le Monde, NPR, DW, Euronews, The Guardian, Reuters, Bloomberg, CNBC, Yahoo News, Le Figaro, LA Times, SCMP, Times of India)
- **OSIRIS** (osirisai.live, API publique sans clé) — vols temps réel (ADS-B), satellites (positions TLE), zones de conflit, séismes USGS

Navigation par **vues séparées** : onglets NEWS / VOLS / SATS / CONFLITS / SÉISMES au-dessus de la carte. Temps réel via **SSE**.

## Stack

- **Backend** : **Bun** (≥1.4) + **Hono** (un seul langage, zéro base de données — état en mémoire)
- **Front** : HTML/CSS/JS vanilla + **MapLibre GL** (tuiles Carto Dark, sans clé API)
- **Temps réel** : Server-Sent Events (news + osiris sur le même stream)
- **Sources** : flux RSS publics + API OSIRIS (aucune clé API requise)

## Lancer

```bash
bun install
bun start
# → http://localhost:3000
```

Mode dev avec rechargement à chaud du serveur :

```bash
bun run dev
```

## Fonctionnement

### News (RSS)
1. Au démarrage puis toutes les **90 s**, le serveur récupère tous les flux (en parallèle).
2. Chaque titre est passé dans un détecteur de pays par mots-clés (`server/geo.js` — ~70 pays + ~90 villes, FR + EN).
3. Les items géolocalisés sont dédupliqués, dotés d'un **niveau d'intensité** (1 faible / 2 moyen / 3 fort selon mots de gravité) et stockés en mémoire (6 h de rétention, max 400).
4. Les nouveaux events sont diffusés en **SSE** → pulsations animées sur la carte + flux latéral (du plus récent en haut).
5. **Regroupement** : les articles partageant la même zone (pays ou ville) forment un seul marqueur avec un badge compteur ; le bloc détail propose une navigation ‹ › du + récent au + ancien.
6. **Filtre de sources** : un select dans le panneau FLUX filtre flux et carte sur une rédaction.
7. Bouton **SCAN** dans la barre supérieure : relance manuelle d'un scan (throttle 30 s, retour visuel sur le bouton). Légende d'intensité repliable en bas à gauche.

### OSIRIS (vols, satellites, conflits, séismes)
1. Au démarrage puis toutes les **60 s**, le connecteur (`server/osiris.js`) interroge 4 endpoints d'osirisai.live — chacun avec son propre TTL (60–120 s) pour respecter les caches amont.
2. Les données sont **normalisées** dans un format event unifié `{ id, kind, lat, lng, title, sub, url, ts, intensity, meta }` — le même contrat que les news.
3. Vols et satellites sont **échantillonnés géographiquement** (buckets 10°×10°) pour rester à ~250/60 marqueurs, le DOM ne voit jamais les 9 000 avions bruts.
4. Diffusion via le même stream SSE (event `osiris`), snapshot initial via `GET /api/osiris`.
5. Côté front, chaque vue a ses marqueurs dédiés (losange cyan = vol, carré jaune = satellite, disque rouge = conflit, carré orange = séisme) et son flux latéral.

### Positionnement en deux niveaux

Dézoomé, chaque event est placé sur le **centroïde du pays** (évite l'empilement). À partir du zoom 3, si une **ville** est mentionnée dans le titre (ex. "Beijing", "Miami"), le marqueur se repositionne précisément sur elle.

### Intensités

| Niveau | Couleur | Exemples de mots-déclencheurs |
|---|---|---|
| 1 · faible | cyan `#37f0c2` | (défaut) |
| 2 · moyen | orange `#ffb347` | crisis, protest, sanction, election… |
| 3 · fort | rouge `#ff5470` | war, attack, killed, earthquake, explosion… |

> **Note Reddit** : désactivé — Reddit bloque les requêtes serveur (403, fingerprint TLS). Pour le réintégrer : API Reddit officielle (OAuth) ou proxy navigateur headless.

## Structure

```
server/
  server.js        # Hono (Bun) : API + SSE + statiques
  aggregator.js    # collecte news, dédoublonnage, diffusion
  osiris.js        # connecteur OSIRIS : vols, sats, conflits, séismes
  sources.js       # liste des flux RSS
  rssParser.js     # parseur RSS (fast-xml-parser)
  fetchClient.js   # fetch avec timeout + retries
  geo.js           # détection pays par mots-clés
public/
  index.html       # structure de la page (+ onglets de vues)
  style.css        # thème dark tech
  app.js           # carte MapLibre + SSE + marqueurs animés + vues
```

## API

| Endpoint | Description |
|---|---|
| `GET /api/events` | Snapshot des news géolocalisées |
| `GET /api/osiris` | Snapshot des items OSIRIS normalisés |
| `POST /api/osiris/refresh` | Force un refresh OSIRIS (bypass TTL) |
| `POST /api/refresh` | Force un scan RSS (throttle 30 s) |
| `GET /api/health` | Liveness + stats |
| `GET /api/stream` | Stream SSE (events `hello`, `events`, `osiris`) |

## Limites connues du MVP

- La détection pays est **heuristique** (mots-clés) : elle génère du bruit (ex. "Paris 2024" → France) et des manques. Une étape NLP (geotagging) est la suite naturelle.
- Twitter/X est **payant** (API ~100 $/mois) et Reddit **bloque les clients serveur** → tous deux volontairement exclus du MVP ; connecteurs optionnels prévus.
- Un seul process, état en mémoire : pour scaler, ajouter Redis + plusieurs workers.
- Certains flux peuvent bloquer ou ralentir — le fetcher a timeout + retries et tolère les échecs par source.

## Pistes d'évolution

- CCTV : couche caméras publiques via `osirisai.live/api/cctv` (déjà normalisé côté Osiris)
- Maritime : ports, chokepoints et positions AIS via `osirisai.live/api/maritime`
- Cyber : CVE et malwares géolocalisés via `osirisai.live/api/cyber-*`
- Clustering des articles sur le même événement (similarité de titres)
- Catégorisation (conflit, économie, catastrophe…) avec code couleur
- Historique animé ("replay" des dernières 24 h)
- Connecteur GDELT (events géolocalisés déjà prêts, gratuit)
- Réintégration Reddit via API officielle OAuth
- Auto-héberger OSIRIS (open source MIT : github.com/simplifaisoul/osiris) pour fiabiliser la source amont

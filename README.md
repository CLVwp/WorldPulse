# WorldPulse 🌍

MVP d'une **fonderie de données OSINT** : une carte du monde (thème papier) où chaque événement apparaît comme une pulsation. Deux familles de sources, un format d'event unifié :

- **NEWS** — 16 sources de presse géolocalisées (BBC, Al Jazeera, France 24, Le Monde, NPR, DW, Euronews, The Guardian, Reuters, Bloomberg, CNBC, Yahoo News, Le Figaro, LA Times, SCMP, Times of India)
- **OSIRIS** (osirisai.live, API publique sans clé) — vols temps réel (ADS-B), satellites, zones de conflit, séismes USGS

Navigation par **vues séparées** : onglets NEWS / VOLS / SATS / CONFLITS / SÉISMES. Rafraîchissement par **polling 45 s**.

## Stack

- **Front** : **Next.js 16** (export statique) + **TypeScript 7** (compilateur natif) + **Tailwind CSS 4** + **MapLibre GL** (tuiles Carto Positron, sans clé API)
- **API** : **Hono** sur **Cloudflare Worker** (assets statiques + API + cron dans un seul Worker)
- **État** : **KV** (binding `CACHE`), aucune base de données
- **Sources** : flux RSS publics + API OSIRIS (aucune clé API requise)
- **Qualité** : biome (lint + format), `tsc --noEmit` strict

## Lancer

```bash
bun install
bun run dev        # front Next.js → http://localhost:3000 (terminal 1)
bun run dev:api    # API Worker + KV local → http://localhost:8787 (terminal 2)
```

En dev, `next.config.ts` proxifie `/api/*` vers `:8787` (rewrite dev uniquement,
surchargeable via `API_PROXY_TARGET`). En prod, l'API est servie sur la même
origine par le Worker : aucun proxy, aucun CORS à configurer.

## Déploiement Cloudflare (1 Worker : assets + API + cron)

```bash
bun run kv:create    # crée le namespace KV, copier l'id dans wrangler.jsonc
bun run deploy       # build (export out/) + wrangler deploy
# → https://worldpulse.<ton-sous-domaine>.workers.dev
```

Test local du Worker complet (assets + API + KV simulé) :

```bash
bun run preview
```

## Budget free tier Cloudflare (objectif : < 20 % de chaque quota)

| Ressource | Quota gratuit | Conso | % |
|---|---|---|---|
| Écrits KV | 1 000/jour | cron `*/10` = 144 écrits (+ scans manuels) | **~15 %** |
| Lectures KV | 100 000/jour | 1 lecture/API call, `Cache-Control: 30 s` en edge | faible |
| Requêtes Worker | 100 000/jour | cron 144/j + polling API (assets statiques **gratuits et illimités**) | faible |
| Stockage KV | 1 GB | 1 snapshot (~200 Ko) | négligeable |

Le levier principal est la **période du cron** (1 écriture KV par passage) :
`*/10` garde les écrits sous 15 % du quota. Les réponses API sont cachées 30 s
(edge + navigateur) pour absorber le polling sans marteler KV.

## Fonctionnement

### News (RSS)
1. Le cron (10 min) hydrate la mémoire de l'isolate depuis KV, scanne les 16 flux en parallèle, re-persiste le snapshot.
2. Chaque titre passe dans un détecteur de pays par mots-clés (`src/worker/geo.ts` — ~70 pays + ~90 villes, FR + EN).
3. Items géolocalisés, dédupliqués, avec **intensité** (1 faible / 2 moyen / 3 fort selon mots de gravité), rétention 6 h, max 400.
4. **Regroupement** : les articles partageant la même zone forment un marqueur avec badge compteur ; le panneau détail propose une navigation ‹ › du + récent au + ancien.
5. **Filtre de sources** : un select dans le panneau FLUX filtre flux et carte.
6. Bouton **SCAN** : scan manuel (throttle 30 s côté serveur).

### OSIRIS (vols, satellites, conflits, séismes)
1. À chaque cycle, le connecteur (`src/worker/osiris.ts`) interroge 4 endpoints — TTL par feed (60–120 s) pour respecter les caches amont.
2. Normalisation dans le format event unifié `{ id, kind, lat, lng, title, sub, url, ts, intensity, meta }`.
3. Vols et satellites **échantillonnés géographiquement** (buckets 10°×10°) → ~250/60 marqueurs max, le DOM ne voit jamais les 9 000 avions bruts. Rétention 15 min.
4. Chaque vue a ses marqueurs dédiés (losange bleu = vol, carré ambre = satellite, disque rouge = conflit, carré orange = séisme).

### Positionnement en deux niveaux
Dézoomé (< zoom 3), chaque event est placé sur le **centroïde du pays**. À partir du zoom 3, si une **ville** est mentionnée dans le titre, le marqueur se repositionne sur elle.

### Intensités

| Niveau | Couleur | Exemples de mots-déclencheurs |
|---|---|---|
| 1 · faible | teal `#0d9488` | (défaut) |
| 2 · moyen | ambre `#d97706` | crisis, protest, election, court… |
| 3 · fort | rouge `#dc2626` | war, attack, killed, earthquake… |

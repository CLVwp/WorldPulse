# WorldPulse 🌍

MVP d'une webapp de visualisation de l'actualité mondiale : une carte du monde dark mode où chaque événement géolocalisé apparaît comme une pulsation animée par pays, agrégée depuis **16 sources de presse** (BBC, Al Jazeera, France 24, Le Monde, NPR, DW, Euronews, The Guardian, Reuters, Bloomberg, CNBC, Yahoo News, Le Figaro, LA Times, SCMP, Times of India). Temps réel via **SSE**.

## Stack

- **Backend** : Node.js + Express (un seul langage, zéro base de données — état en mémoire)
- **Front** : HTML/CSS/JS vanilla + **MapLibre GL** (tuiles Carto Dark, sans clé API)
- **Temps réel** : Server-Sent Events
- **Sources** : flux RSS publics (aucune clé API requise)

## Lancer

```bash
npm install
npm start
# → http://localhost:3000
```

Mode dev avec rechargement auto du serveur :

```bash
npm run dev
```

## Fonctionnement

1. Au démarrage puis toutes les **90 s**, le serveur récupère tous les flux (en parallèle).
2. Chaque titre est passé dans un détecteur de pays par mots-clés (`server/geo.js` — ~70 pays + ~90 villes, FR + EN).
3. Les items géolocalisés sont dédupliqués, dotés d'un **niveau d'intensité** (1 faible / 2 moyen / 3 fort selon mots de gravité) et stockés en mémoire (6 h de rétention, max 400).
4. Les nouveaux events sont diffusés en **SSE** → pulsations animées sur la carte + flux latéral (du plus récent en haut).
5. **Regroupement** : les articles partageant la même zone (pays ou ville) forment un seul marqueur avec un badge compteur ; le bloc détail propose une navigation ‹ › du + récent au + ancien.
6. **Filtre de sources** : un select dans le panneau FLUX filtre flux et carte sur une rédaction.
7. Bouton **SCAN** dans la barre supérieure : relance manuelle d'un scan (throttle 30 s, retour visuel sur le bouton). Légende d'intensité repliable en bas à gauche.

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
  server.js        # Express + SSE + bootstrap
  aggregator.js    # collecte, dédoublonnage, diffusion
  sources.js       # liste des flux RSS
  rssParser.js     # parseur RSS (fast-xml-parser)
  fetchClient.js   # fetch avec timeout + retries
  geo.js           # détection pays par mots-clés
public/
  index.html       # structure de la page
  style.css        # thème dark tech
  app.js           # carte MapLibre + SSE + marqueurs animés
```

## Limites connues du MVP

- La détection pays est **heuristique** (mots-clés) : elle génère du bruit (ex. "Paris 2024" → France) et des manques. Une étape NLP (geotagging) est la suite naturelle.
- Twitter/X est **payant** (API ~100 $/mois) et Reddit **bloque les clients serveur** → tous deux volontairement exclus du MVP ; connecteurs optionnels prévus.
- Un seul process, état en mémoire : pour scaler, ajouter Redis + plusieurs workers.
- Certains flux peuvent bloquer ou ralentir — le fetcher a timeout + retries et tolère les échecs par source.

## Pistes d'évolution

- Clustering des articles sur le même événement (similarité de titres)
- Catégorisation (conflit, économie, catastrophe…) avec code couleur
- Historique animé ("replay" des dernières 24 h)
- Connecteur GDELT (events géolocalisés déjà prêts, gratuit)
- Réintégration Reddit via API officielle OAuth

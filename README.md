# Room Info Card

Carte Lovelace pour Home Assistant : température d'une pièce, **tendance calculée par la carte** (↗ / ↘ / →),
couleur de confort par seuils, pastille de luminance (🌑 / ⛅ / ☀️) et fond « verre dépoli ».
Aucun helper (`binary_sensor` trend, capteur template de couleur), ni mushroom, ni card-mod.

## Installation

1. `npm install && npm run build` (ou récupérer `dist/room-info-card.js`).
2. Copier `dist/room-info-card.js` dans `/config/www/`.
3. Paramètres → Tableaux de bord → Ressources → ajouter `/local/room-info-card.js?v=1` (module JavaScript).
   Incrémenter `v` à chaque mise à jour.

Compatible HACS en dépôt personnalisé (`hacs.json` fourni).

## Exemple

```yaml
type: custom:room-info-card
entity: sensor.chambre_1_temperature
name: Chambre 1
icon: mdi:face-man
luminance:
  entity: sensor.chambre_1_luminance
```

Toutes les options sont aussi éditables depuis l'éditeur graphique.

## Options

| Option | Défaut | Description |
|---|---|---|
| `entity` | — (obligatoire) | Capteur de température |
| `name` | friendly_name | Nom affiché |
| `icon` | icône de l'entité | Icône |
| `decimals` | `1` | Décimales affichées |
| `tap_action` | `more-info` | Action standard HA |
| `trend.enabled` | `true` | Calcul et affichage de la tendance |
| `trend.window` | `30` | Fenêtre d'historique comparée (min) |
| `trend.stable_threshold` | `0.2` | Écart (°) en dessous duquel la tendance est stable |
| `trend.show_stable` | `true` | Afficher → quand stable |
| `comfort.cold_below` | `19` | En dessous : couleur froide |
| `comfort.hot_above` | `22` | Au-dessus : couleur chaude |
| `luminance.entity` | — | Capteur de luminance (pastille optionnelle) |
| `luminance.dark_below` | `5000` | lx, en dessous : 🌑 |
| `luminance.bright_above` | `20000` | lx, au-dessus : ☀️ |
| `style.background` | `glass` | `glass`, `solid` ou `none` |
| `style.tint` | `none` | `none`, `temperature` ou `custom` |
| `style.tint_color` | — | `[r, g, b]` ou `#hex` (si `tint: custom`) |
| `style.tint_opacity` | `0.25` | Opacité de la teinte |
| `style.opacity` | `0.35` | Opacité du fond verre |
| `style.blur` | `14` | Flou (px) |
| `style.radius` | `16` | Arrondi (px) |
| `style.font_size` | `10` | Taille du texte (px) |
| `style.icon_size` | `36` | Diamètre du rond d'icône (px) |
| `style.colors.*` | blue / green / red / orange / blue / green | `cold`, `comfort`, `hot`, `trend_up`, `trend_down`, `trend_stable` — nom de couleur HA, `#hex` ou `rgb()` |

## Tendance

Au chargement, la carte lit l'historique du capteur sur `trend.window` minutes, puis suit les nouveaux états.
Elle compare la valeur actuelle à celle du début de la fenêtre : `|écart| < stable_threshold` → stable,
sinon hausse ou baisse. Sans historique (recorder exclu, capteur neuf), aucune flèche n'est affichée.

## Développement

```bash
npm test        # tests unitaires (Vitest)
npm run dev     # page de démo avec hass simulé (dev/)
npm run build   # dist/room-info-card.js
```

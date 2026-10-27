# room-info-card — Design

Date : 2026-10-27
Statut : validé (design), en attente de relecture de la spec

## 1. Objectif

Remplacer les tuiles de température du dashboard tablette (actuellement des
`custom:mushroom-template-card` + `card_mod` par pièce) par une carte Lovelace
custom unique, `custom:room-info-card`, qui :

- affiche température, nom, icône d'une pièce dans le même rendu « verre dépoli »
  qu'aujourd'hui ;
- **calcule elle-même la tendance** (↗ / ↘ / →) à partir de l'historique du
  capteur, sans les deux `binary_sensor` de tendance par pièce ;
- **calcule elle-même la couleur de confort** à partir de seuils, sans les
  capteurs template `sensor.couleur_temp_*` ;
- conserve la pastille de luminance (🌑 / ⛅ / ☀️) via une entité optionnelle ;
- ne dépend ni de mushroom ni de card-mod ;
- se configure entièrement via l'éditeur graphique de Home Assistant, avec des
  options de style.

Format : **une carte = une pièce**, placée dans une grille (`type: grid`)
comme aujourd'hui.

### Critères de succès

- Une carte minimale (`entity`, `name`, `icon`) reproduit visuellement les
  tuiles actuelles avec les valeurs par défaut.
- Aucun helper/capteur template n'est nécessaire pour la tendance ni la couleur.
- Toutes les options sont éditables depuis l'UI sans YAML.
- La logique (tendance, couleurs, luminance, fusion de config) est couverte par
  des tests unitaires.

### Hors périmètre

- Mode grille intégré (la disposition reste gérée par `type: grid`).
- Suppression des anciens helpers : faite manuellement par l'utilisateur après
  validation de la nouvelle carte.
- Publication HACS publique (le dépôt reste compatible HACS « custom repository »).

## 2. Configuration

Seul `entity` est obligatoire. Les valeurs ci-dessous sont les défauts.

```yaml
type: custom:room-info-card
entity: sensor.ble_temperature_chambre_antoine  # obligatoire
name: <friendly_name de l'entité>
icon: <icône de l'entité>
decimals: 1                # 0..2
tap_action:                # format standard ui_action
  action: more-info        # more-info | navigate | none

trend:
  enabled: true
  window: 30               # minutes, 5..240
  stable_threshold: 0.2    # °, |delta| < seuil → stable
  show_stable: true        # afficher → quand stable

comfort:
  cold_below: 19           # valeur < 19 → cold
  hot_above: 22            # valeur > 22 → hot ; sinon comfort

luminance:                 # bloc optionnel, absent = pas de pastille
  entity: sensor.xxx_luminance
  dark_below: 5000         # lux < 5000 → 🌑
  bright_above: 20000      # lux > 20000 → ☀️ ; sinon ⛅

style:
  background: glass        # glass | solid | none
  tint: none               # none | temperature | custom
  tint_color: null         # [r, g, b] (color_rgb) ou '#hex', requis si tint: custom
  tint_opacity: 0.25       # 0..1
  blur: 14                 # px, glass uniquement
  opacity: 0.35            # 0..1, opacité du fond glass
  radius: 16               # px
  font_size: 10            # px, température et nom
  icon_size: 36            # px, diamètre du rond d'icône (icône = ~47 %)
  colors:
    cold: blue
    comfort: green
    hot: red
    trend_up: orange
    trend_down: blue
    trend_stable: green
```

Règles :

- Les couleurs acceptent un nom de couleur HA (`blue`, `light-green`,
  `deep-orange`…, résolu en `var(--<nom>-color)`), un `#hex` ou `rgb()`.
- La config fournie est fusionnée en profondeur avec les défauts
  (`mergeConfig`). `setConfig` lève une erreur si `entity` est absent, ce qui
  affiche la carte d'erreur standard de HA.
- Égalités aux seuils : `value === cold_below` → comfort ; `value === hot_above`
  → comfort ; `lux === dark_below` → ⛅ ; `lux === bright_above` → ⛅ ;
  `|delta| === stable_threshold` → pas stable (montée/descente).

## 3. Rendu

```
┌───────────────────┐
│   🌑╭────╮↗       │  pastille luminance (haut-gauche), tendance (haut-droite)
│     │ 🙂 │        │  rond d'icône teinté (couleur confort, 20 %)
│     ╰────╯        │  icône colorée (couleur confort)
│      19.7°        │  température
│     Antoine       │  nom
└───────────────────┘
```

- Pastilles : ronds de 16 px, débordant de 2 px du rond d'icône. Tendance =
  icône `mdi:arrow-top-right-thick` / `mdi:arrow-bottom-right-thick` /
  `mdi:arrow-right-bold`, blanche sur fond `trend_*`. Luminance = emoji sur
  fond bleu (`#007bff`) / vert (`#28a745`) / jaune (`#ffc107`).
- Fond :
  - `glass` : `rgba(255,255,255,opacity)`, `backdrop-filter: blur(blur) saturate(160%)`,
    bordure `1px solid rgba(255,255,255,0.35)`, ombre `0 4px 16px rgba(0,0,0,0.12)` ;
  - `solid` : fond de carte HA standard (`--ha-card-background`) ;
  - `none` : transparent, sans bordure ni ombre.
- Teinte (superposée au fond) : `temperature` → couleur confort courante,
  `custom` → `tint_color`, à `tint_opacity`.
- Valeur indisponible (`unknown`, `unavailable`, non numérique, entité absente) :
  texte « — », icône et rond en gris (`--disabled-color`), pas de pastille de
  tendance, teinte `temperature` désactivée.
- Température affichée : `value.toFixed(decimals)` + `°`.
- Clic : `tap_action` déclenché via l'événement `hass-action` (comportement
  standard HA). Carte focusable au clavier (Enter/Espace).
- Taille : `getGridOptions()` → `{ columns: 3, rows: 2, min_columns: 2, min_rows: 2 }` ;
  `getCardSize()` → 2.

## 4. Tendance

Module pur `trend.ts` + module I/O `history.ts`.

1. **Chargement initial** (à la première réception de `hass` et après chaque
   reconnexion) : appel WebSocket
   `history/history_during_period` avec `start_time = now - window`,
   `entity_ids: [entity]`, `include_start_time_state: true`,
   `minimal_response: true`, `no_attributes: true`, `significant_changes_only: false`.
   Les points sont convertis en `{ t: ms, v: number }`, valeurs non
   numériques ignorées.
2. **Mises à jour** : à chaque `set hass`, si `last_updated` de l'entité a
   changé et que l'état est numérique, le point est ajouté au tampon.
3. **Glissement** : un `setInterval` de 60 s recalcule (et purge) même sans
   nouvel état. Démarré dans `connectedCallback`, arrêté dans
   `disconnectedCallback`.
4. **Purge** : on conserve le dernier point antérieur ou égal à
   `now - window` (valeur de référence) et tous les points postérieurs.
5. **Calcul** `computeTrend(points, now, windowMs, threshold)` :
   - référence = dernier point avec `t <= now - window`, sinon le plus ancien
     point disponible ;
   - courant = dernier point ;
   - aucun point → `null` (pas de pastille) ;
   - référence = courant (dernière valeur antérieure à la fenêtre, capteur
     silencieux) → `stable` : la valeur a tenu toute la fenêtre ;
   - un seul point, dans la fenêtre → `null` (historique insuffisant) ;
   - `delta = courant.v - référence.v` ; `|delta| < threshold` → `stable`,
     `delta > 0` → `up`, sinon `down`.
6. `stable` est masqué si `show_stable: false`. Toute erreur d'appel
   historique est journalisée (`console.warn`) et produit `null`.
7. Un changement de `entity` ou `trend.window` dans la config vide le tampon et
   relance le chargement.

## 5. Éditeur graphique

`editor.ts` : élément `room-info-card-editor`, basé sur `ha-form` avec schéma
en panneaux `expandable`. Émet `config-changed` avec la config épurée : les
clés égales aux défauts sont retirées (`pruneDefaults`).

| Panneau | Champs |
|---|---|
| Général (ouvert) | `entity` (entity, domaine `sensor`, device_class `temperature`), `name` (text), `icon` (icon), `decimals` (number 0–2), `tap_action` (ui_action) |
| Tendance | `trend.enabled` (boolean), `trend.window` (number 5–240, min), `trend.stable_threshold` (number 0–2, pas 0.1), `trend.show_stable` (boolean) |
| Confort | `comfort.cold_below`, `comfort.hot_above` (number, pas 0.5) |
| Luminance | `luminance.entity` (entity, device_class `illuminance`), `luminance.dark_below`, `luminance.bright_above` (number) |
| Apparence | `style.background` (select), `style.tint` (select), `style.tint_color` (color_rgb, si `tint: custom`), `style.tint_opacity`, `style.opacity` (number slider 0–1), `style.blur` (0–30), `style.radius` (0–32), `style.font_size` (8–24), `style.icon_size` (24–64) |
| Couleurs | 6 champs `style.colors.*` (ui_color) |

- Libellés via `computeLabel` : français si `hass.locale.language` commence par
  `fr`, anglais sinon.
- `static getStubConfig(hass)` : premier `sensor.*` avec
  `device_class: temperature`, sinon `{ entity: "" }`.
- Enregistrement : `customElements.define` + entrée `window.customCards`
  (`type: "room-info-card"`, nom, description, `preview: true`).

## 6. Structure et outillage

```
room_info_card/
├── src/
│   ├── room-info-card.ts   # LitElement, rendu, cycle de vie, tap_action
│   ├── editor.ts           # éditeur ha-form
│   ├── config.ts           # types, DEFAULTS, mergeConfig, pruneDefaults, validation
│   ├── trend.ts            # computeTrend, prune (purs)
│   ├── history.ts          # fetchHistory(hass, entity, windowMs)
│   ├── colors.ts           # comfortLevel, luminanceLevel, resolveColor (purs)
│   ├── localize.ts         # libellés fr/en
│   └── styles.ts           # css Lit
├── tests/                  # Vitest : trend, colors, config
├── dev/index.html          # page de démo avec hass simulé
├── dist/room-info-card.js  # bundle unique (commité pour HACS)
├── package.json, tsconfig.json, rollup.config.mjs, hacs.json, README.md
```

- TypeScript strict, Lit 3, Rollup (node-resolve, typescript, terser), Vitest.
- Types HA minimaux déclarés localement (pas de dépendance à
  `custom-card-helpers`).
- Scripts : `build`, `watch`, `test`, `dev` (serveur statique pour `dev/`).

## 7. Tests et vérification

- **Unitaires (Vitest)** :
  - `computeTrend` : montée, descente, stable, égalité au seuil, < 2 points,
    référence = dernier point avant la fenêtre, aucun point avant la fenêtre ;
  - `prune` : garde la référence, supprime les points plus anciens ;
  - `comfortLevel` / `luminanceLevel` : chaque plage et chaque égalité ;
  - `resolveColor` : nom HA, hex, rgb ;
  - `mergeConfig` / `pruneDefaults` : fusion profonde, aller-retour, erreur sans `entity`.
- **Visuelle** : `dev/index.html` affiche les 10 pièces (dont indisponible,
  teinte custom, sans luminance) sur un fond image ; vérification dans le
  navigateur intégré.
- **Réelle** : ressource `/local/room-info-card.js` dans HA, une carte de test
  ajoutée via l'éditeur graphique.

## 8. Migration

Fournir le YAML de remplacement des 10 tuiles actuelles (entités de
température, icônes, entités de luminance reprises de la config existante ;
Devant / Derrière avec `tint: custom` vert). Les `binary_sensor` de tendance et
`sensor.couleur_temp_*` ne sont pas supprimés par ce projet.

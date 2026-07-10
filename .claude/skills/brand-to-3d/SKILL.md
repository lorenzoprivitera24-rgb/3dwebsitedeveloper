---
name: brand-to-3d
description: >
  Il cookbook della filiera brand→3D: da un logo SVG/PNG del cliente ai tre trattamenti standard
  (estrusione premium, scomposizione particellare, massa fluida) con parametri, budget per tier e
  gotcha noti (fill-rule evenodd, path malformati, text non convertito, budget particelle
  mobile). Usare con l'agente brand-alchemist quando un brief porta un logo/brand esistente da
  trasformare in elemento 3D animato. Prerequisito: brief/brand-kit.json da
  scripts/extract-brand.mjs. Trigger: "logo 3D", "anima il logo", "scomponi il logo in
  particelle", "logo fluido", "estrusione del marchio".
---

# Brand → 3D — il cookbook dei tre trattamenti

Input sempre da `node scripts/extract-brand.mjs <logo.svg|png> [riferimento.jpg]` →
`brief/brand-kit.json` (+ `brand-kit.md` per il gate umano). Mai partire dal file grezzo: il
brand-kit ha già colori, complessità path, fattibilità per trattamento e budget suggeriti.

## Scegliere il trattamento (tabella di decisione)

| Carattere del brand | Trattamento | Perché |
|---|---|---|
| Istituzionale, geometrico, solido | **Estrusione premium** | massa e materiali comunicano stabilità |
| Tech, dinamico, "trasformazione" | **Particellare** | scomposizione→ricomposizione = narrativa |
| Organico, liquido, cosmetico/lusso | **Fluido** | il marchio emerge come materia |

Regola d'oro: **a riposo il logo è IL logo** (proporzioni, colori ufficiali, safe area). La
trasformazione è il viaggio, non la destinazione.

## Ricetta 1 — Estrusione premium

- `SVGLoader` → `toShapes(true)` → `ExtrudeGeometry` con `depth` 4-8% dell'altezza logo,
  `bevelSize` piccolo (0.5-1%), `bevelSegments` 2-3 (di più = costo inutile).
- Materiale: `MeshStandardNodeMaterial`/`MeshPhysicalNodeMaterial` con l'IBL della scena; i
  colori dai token brand (mai hex inline). Clearcoat leggero per il filone premium.
- Gotcha: **`fill-rule="evenodd"` rompe i buchi** (contro-path invertiti): controlla
  `brand-kit.trattamenti3d.estrusione.pathProblematici`; se serve, normalizza i path a nonzero
  (inverti l'ordine dei punti dei buchi). `<text>` non convertito in path → convertire PRIMA
  (Inkscape/Illustrator), lo script lo segnala. Parti raster (`<image>`) non si estrudono:
  o si escludono o si trattano come decal su un piano.
- Animazione: entrata per gruppi di shape (stagger sui sotto-path), rotazioni MAI oltre ±25°
  dall'angolo di lettura (il logo deve restare leggibile), damp su pointer.
- Costo: basso (una mesh, poche migliaia di triangoli). Tier: tutti.

## Ricetta 2 — Scomposizione particellare (TSL compute)

- Campionamento: rasterizza il logo off-screen (canvas) e campiona i pixel non trasparenti →
  posizioni target; oppure campiona i path SVG a intervalli d'arco per un contorno pulito.
- Compute TSL: buffer posizioni + velocità; stati `sparso` ↔ `composto` guidati da un progress
  (scroll o timeline GSAP). Colore per particella dal pixel campionato (pattern "Milkmaid").
- Budget dal brand-kit: **mobile ≤ 15k, desktop ≤ 60k** particelle (di default; re-argomenta nel
  README del modulo se serve di più). Point sprites o instanced quad, MAI mesh per particella.
- Fallback WebGL2 (niente compute): riduci a 1/4 e anima in vertex shader con curl noise
  pre-calcolato, o degrada all'estrusione.
- Gotcha: la ricomposizione deve arrivare a NITIDEZZA totale (le particelle si fondono nel
  logo o vengono sostituite dal mark vettoriale in cross-fade al 95% del progress — il logo
  "quasi a fuoco" per sempre è il difetto n°1 del pattern).
- Reduced motion: stato composto fisso, o un solo cross-fade.

## Ricetta 3 — Massa fluida

- Il logo come **influence map**: rasterizza il mark in una texture e usala per pilotare
  displacement/soglie su una superficie TSL (piano ad alta suddivisione o SDF raymarched
  semplice); il marchio emerge dalla materia e vi si dissolve.
- Parametri: viscosità (damp del campo), soglia di emersione (progress), tinta dai token.
- Costo: il più alto dei tre — tier alto/desktop; fallback = estrusione o particellare lite.
- Gotcha: su marchi sottili/tipografici l'emersione fluida distrugge la leggibilità → usare
  la variante "il fluido rivela" (maschera che si apre) invece di "il fluido è il logo".

## Brand motion system (l'addendum a direction.md)

Dal carattere del brand derivare e scrivere nei token: curva easing firma (es. istituzionale =
easeInOutQuart lento; tech = expo con overshoot minimo), durate (micro/scene), ampiezze
(quanto "respira" il logo a riposo: 0 per legal/finance, sottile per il resto). Ogni voce con
l'equivalente reduced-motion. Questo vocabolario governa TUTTE le animazioni brand del sito,
non solo il logo (coerenza = premium).

## QA specifico brand

- Shot a 390px: il logo composto è nitido e proporzionato? (safe area dal brand-kit)
- Il colore del mark corrisponde ai token (delta visivo zero su sfondo chiaro e scuro)?
- `prefers-reduced-motion`: il brand appare senza viaggio, con dignità?
- Il cliente riconosce il suo marchio al primo sguardo? (gate umano S1/S6 — se esita, il
  trattamento ha vinto sul brand: torna indietro.)

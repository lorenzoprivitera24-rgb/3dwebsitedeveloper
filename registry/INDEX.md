# Registro — indice dei blueprint

Stato: **8/14 implementati** (01·02·03·05·06 lug 2026 + **07·13·14 ago 2026**, famiglia «prodotto
a strati»). Backlog extra dalla ricognizione lug 2026 in coda.

| # | id | Copre | Stato |
|---|---|---|---|
| 01 | `preloader-progress` | caricamento asset reale, counter, sipario | ✅ implementato |
| 02 | `hero-3d-split` | split editoriale + GLB prodotto | ✅ implementato |
| 03 | `mesh-gradient-field` | gradient TSL animato full screen | ✅ implementato |
| 04 | `pointer-rig-3d` | oggetto che segue il puntatore | pianificato |
| 05 | `pinned-scene-scrub` | sezione pinnata, scena che si trasforma | ✅ implementato |
| 06 | `kinetic-type` | SplitText, display gigante | ✅ implementato |
| 07 | `editorial-gallery` | griglia listino + reveal a cascata + parallasse per card | ✅ implementato |
| 08 | `spec-sheet-latex` | KaTeX + footnote | pianificato |
| 09 | `interaction-card` | decode/scramble, flip, magnetic | pianificato |
| 10 | `display-statement` | type gigante su foto, eyebrow mono | pianificato |
| 11 | `horizontal-scroll-strip` | galleria orizzontale pinnata | pianificato |
| 12 | `footer-cta` | marquee + CTA magnetico + uscita | pianificato |
| 13 | `product-explode` | vista esplosa scrubbata di scontornati + annotazioni | ✅ implementato |
| 14 | `type-behind-product` | display condensato che passa DIETRO lo scontornato | ✅ implementato |
| — | `pointer-ripple-image` | ripple cursor-reactive (da Framer Shaders) | backlog recon |
| — | `instanced-crowd-physics` | folla istanziata + fisica worker (da threejs.paris) | backlog recon |
| — | `organic-svg-buttons` | bottoni SVG deformati dal cursore | backlog recon |

## La famiglia «prodotto a strati» (07 · 13 · 14)

Nasce dalla ricognizione di agosto 2026 su un sito di prodotto Framer
(`docs/recon-prodotto-a-strati-ago2026.md`): un genere che **non è 3D** e che il registro non
copriva affatto. Condividono un solo contratto di asset — il manifesto di
`scripts/encode-cutouts.mjs` — e una grammatica comune, codificata nella skill
**`layered-product-choreography`**.

Sequenza che funziona: **mostra l'oggetto → aprilo (13) → nominalo (14) → vendilo (07)**.

Precondizione dura per tutti e tre: **fotografia scontornata con alpha vera, su tela condivisa**.
Con JPEG su fondo pieno il blueprint 14 non ha niente da occludere e il 13 non ha strati da
separare. Va detto al cliente in S0, non scoperto in S5.

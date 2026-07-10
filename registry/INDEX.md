# Registro — indice dei blueprint

Stato: **5/12 implementati** (01·02·03·05·06, lug 2026 — composti nella demo del kit, vedi
`brief/composition-plan.md`). Backlog extra dalla ricognizione lug 2026 in coda.

| # | id | Copre | Stato |
|---|---|---|---|
| 01 | `preloader-progress` | caricamento asset reale, counter, sipario | ✅ implementato |
| 02 | `hero-3d-split` | split editoriale + GLB prodotto | ✅ implementato |
| 03 | `mesh-gradient-field` | gradient TSL animato full screen | ✅ implementato |
| 04 | `pointer-rig-3d` | oggetto che segue il puntatore | pianificato |
| 05 | `pinned-scene-scrub` | sezione pinnata, scena che si trasforma | ✅ implementato |
| 06 | `kinetic-type` | SplitText, display gigante | ✅ implementato |
| 07 | `editorial-gallery` | griglia magazine + parallax + reveal | pianificato |
| 08 | `spec-sheet-latex` | KaTeX + footnote | pianificato |
| 09 | `interaction-card` | decode/scramble, flip, magnetic | pianificato |
| 10 | `display-statement` | type gigante su foto, eyebrow mono | pianificato |
| 11 | `horizontal-scroll-strip` | galleria orizzontale pinnata | pianificato |
| 12 | `footer-cta` | marquee + CTA magnetico + uscita | pianificato |
| — | `pointer-ripple-image` | ripple cursor-reactive (da Framer Shaders) | backlog recon |
| — | `instanced-crowd-physics` | folla istanziata + fisica worker (da threejs.paris) | backlog recon |
| — | `organic-svg-buttons` | bottoni SVG deformati dal cursore | backlog recon |
| 13 | `logo-hero-3d` | brand del cliente in 3D: estrusione / particelle / fluido (skill `brand-to-3d`, agente brand-alchemist) | pianificato (ricerca lug 2026) |
| 14 | `ambient-ecosystem` | particelle ambientali / boids TSL compute, densità per tier (agente world-builder) | pianificato (ricerca lug 2026) |
| 15 | `volumetric-atmosphere` | profondità: fog layering + god rays (fake→volumetrico per tier) | pianificato (ricerca lug 2026) |
| 16 | `playable-physics` | sandbox rapier in sezione: drag & throw, easter egg fisico (agente gameplay-engineer) | pianificato (ricerca lug 2026) |
| 17 | `splat-hero` | hero fotoreale Gaussian splat (.spz via Spark), poster fallback | R&D (ricerca lug 2026) |
| 18 | `vt-page-transition` | sipario tra route con View Transitions API (same-doc Baseline) | pianificato (ricerca lug 2026) |

> Template per nuovi blueprint: `registry/_template/` (meta.json + README con checklist di
> promozione). Nessun blueprint entra nell'indice senza checklist spuntata.

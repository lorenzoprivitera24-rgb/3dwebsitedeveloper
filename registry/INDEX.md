# Registro — indice dei blueprint

Stato: **13/15 implementati** (01-07·09·11-15 — mancano 08 e 10). La famiglia «prodotto a
strati» è 13·14·15 (ago 2026); il backlog della ricerca lug 2026 è rinumerato 16-21.
Backlog extra dalla ricognizione lug 2026 in coda.

| # | id | Copre | Stato |
|---|---|---|---|
| 01 | `preloader-progress` | caricamento asset reale, counter, sipario | ✅ implementato |
| 02 | `hero-3d-split` | split editoriale + GLB prodotto | ✅ implementato |
| 03 | `mesh-gradient-field` | gradient TSL animato full screen | ✅ implementato · manopole in `looks/03-gradient.json` |
| 04 | `pointer-rig-3d` | oggetto che segue il puntatore | ✅ implementato |
| 05 | `pinned-scene-scrub` | sezione pinnata, scena che si trasforma | ✅ implementato |
| 06 | `kinetic-type` | SplitText, display gigante | ✅ implementato |
| 07 | `editorial-gallery` | griglia magazine + parallax per colonna + reveal | ✅ implementato |
| 08 | `spec-sheet-latex` | KaTeX + footnote | pianificato |
| 09 | `interaction-card` | decode/scramble, flip, magnetic | ✅ implementato |
| 10 | `display-statement` | type gigante su foto, eyebrow mono | pianificato |
| 11 | `horizontal-scroll-strip` | galleria orizzontale pinnata | ✅ implementato |
| 12 | `footer-cta` | marquee + CTA magnetico + velo di contrasto | ✅ implementato |
| 13 | `product-explode` | vista esplosa scrubbata di scontornati + annotazioni | ✅ implementato |
| 14 | `type-behind-product` | display condensato che passa DIETRO lo scontornato | ✅ implementato |
| 15 | `product-gallery` | griglia listino di scontornati + `layerId` per strato | ✅ implementato |
| — | `pointer-ripple-image` | ripple cursor-reactive (da Framer Shaders) | backlog recon |
| — | `instanced-crowd-physics` | folla istanziata + fisica worker (da threejs.paris) | backlog recon |
| — | `organic-svg-buttons` | bottoni SVG deformati dal cursore | backlog recon |
| 16 | `logo-hero-3d` | brand del cliente in 3D: estrusione / particelle / fluido (skill `brand-to-3d`, agente brand-alchemist) | pianificato (ricerca lug 2026) |
| 17 | `ambient-ecosystem` | particelle ambientali / boids TSL compute, densità per tier (agente world-builder) | pianificato (ricerca lug 2026) |
| 18 | `volumetric-atmosphere` | profondità: fog layering + god rays (fake→volumetrico per tier) | pianificato (ricerca lug 2026) |
| 19 | `playable-physics` | sandbox rapier in sezione: drag & throw, easter egg fisico (agente gameplay-engineer) | pianificato (ricerca lug 2026) |
| 20 | `splat-hero` | hero fotoreale Gaussian splat (.spz via Spark), poster fallback | R&D (ricerca lug 2026) |
| 21 | `vt-page-transition` | sipario tra route con View Transitions API (same-doc Baseline) | pianificato (ricerca lug 2026) |

> Template per nuovi blueprint: `registry/_template/` (meta.json + README con checklist di
> promozione). Nessun blueprint entra nell'indice senza checklist spuntata.

## Ordine in pagina e regia

L'ordine dei blueprint nella demo **è** l'ordine dei canali in `src/scroll/progressMap.ts` e delle
tratte nel `CameraDirector`: hero → gradient → scrub → explode → veil → prodgallery → gallery → strip → card → pointer → kinetic → footer.
La regia si passa il testimone fra tratte consecutive dando per scontato che, quando una sezione ha
progresso > 0, la precedente sia già a 1. **Se sposti una sezione nel DOM, spostala anche là.**

## Le tre lezioni che i blueprint 07-12 hanno lasciato

1. **La scena viva è un problema di contrasto.** Un blueprint di solo testo sopra il canvas
   persistente non è leggibile per costruzione: la forma si muove, e prima o poi la sua parte
   illuminata finisce sotto un paragrafo. Arretrare la camera nel capitolo non basta — dipende da
   dove sta la forma in quel frame. Serve anche un velo (`.bp-gallery`, `.bp-cards`,
   `.bp-footer__inner`).
2. **Una griglia che contiene una traccia non-wrap va vincolata con `minmax(0, 1fr)`**, o la colonna
   si allarga per contenerla e i titoli smettono di andare a capo. Si vede solo su viewport stretti.
3. **Un'entrata più lunga dell'attesa di QA rende lo scatto non deterministico.** Lo scramble del 09
   dura 1,1 s: con l'attesa a 900 ms si fotografava il titolo a metà decodifica, e nessun confronto
   sarebbe mai stato stabile. `shoot.mjs` ora attende 1700 ms.

## La famiglia «prodotto a strati» (13 · 14 · 15)

Nasce dalla ricognizione di agosto 2026 su un sito di prodotto Framer
(`docs/recon-prodotto-a-strati-ago2026.md`): un genere che **non è 3D** e che il registro non
copriva affatto. Condividono un solo contratto di asset — il manifesto di
`scripts/encode-cutouts.mjs` — e una grammatica comune, codificata nella skill
**`layered-product-choreography`**.

Sequenza che funziona: **mostra l'oggetto → aprilo (13) → nominalo (14) → vendilo (15)**.

Precondizione dura per tutti e tre: **fotografia scontornata con alpha vera, su tela condivisa**.
Con JPEG su fondo pieno il blueprint 14 non ha niente da occludere e il 13 non ha strati da
separare. Va detto al cliente in S0, non scoperto in S5.

# Registro — indice dei blueprint

Stato: **9/12 implementati** (01·02·03·05·06·07·09·11·12 — ago 2026, tutti composti nella demo del
kit e passati per la QA visiva su pagina reale, vedi `brief/composition-plan.md`).
Backlog extra dalla ricognizione lug 2026 in coda.

| # | id | Copre | Stato |
|---|---|---|---|
| 01 | `preloader-progress` | caricamento asset reale, counter, sipario | ✅ implementato |
| 02 | `hero-3d-split` | split editoriale + GLB prodotto | ✅ implementato |
| 03 | `mesh-gradient-field` | gradient TSL animato full screen | ✅ implementato · manopole in `looks/03-gradient.json` |
| 04 | `pointer-rig-3d` | oggetto che segue il puntatore | pianificato |
| 05 | `pinned-scene-scrub` | sezione pinnata, scena che si trasforma | ✅ implementato |
| 06 | `kinetic-type` | SplitText, display gigante | ✅ implementato |
| 07 | `editorial-gallery` | griglia magazine + parallax per colonna + reveal | ✅ implementato |
| 08 | `spec-sheet-latex` | KaTeX + footnote | pianificato |
| 09 | `interaction-card` | decode/scramble, flip, magnetic | ✅ implementato |
| 10 | `display-statement` | type gigante su foto, eyebrow mono | pianificato |
| 11 | `horizontal-scroll-strip` | galleria orizzontale pinnata | ✅ implementato |
| 12 | `footer-cta` | marquee + CTA magnetico + velo di contrasto | ✅ implementato |
| — | `pointer-ripple-image` | ripple cursor-reactive (da Framer Shaders) | backlog recon |
| — | `instanced-crowd-physics` | folla istanziata + fisica worker (da threejs.paris) | backlog recon |
| — | `organic-svg-buttons` | bottoni SVG deformati dal cursore | backlog recon |

## Ordine in pagina e regia

L'ordine dei blueprint nella demo **è** l'ordine dei canali in `src/scroll/progressMap.ts` e delle
tratte nel `CameraDirector`: hero → gradient → scrub → gallery → strip → card → kinetic → footer.
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

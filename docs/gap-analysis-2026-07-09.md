# Gap analysis: cosa manca al kit per «siti motion/3D a richiesta» (stato reale al 9 luglio 2026)

Fonti: ricognizione codice del 9 lug (`recon/`), dossier + playbook + deep-dive (`docs/`), e verifica diretta del repo (package.json, `.claude/`, `scripts/`, ROADMAP.md). Ogni «manca» qui sotto è verificato sul filesystem, non presunto.

## La tesi, in una riga

**Il gap non è tecnologico: è di sistema produttivo.** Lo stack di rendering c'è ed è giusto (three 0.184 WebGPU+TSL, R3F 9.6, GSAP 3.13, Lenis 1.3, Motion 12 — threejs.paris dimostra che è lo stack vincente in produzione). Mancano le tre cose che permettono a Framer/Relume/v0 di «produrre a richiesta»: **la libreria da cui comporre, la pipeline a stadi, il loop che vede il risultato**. E manca il ponte tra il laboratorio Vite attuale e un sito cliente vero (Next, transizioni, LCP).

## I tre assi (dalla reverse engineering)

I quattro siti smontati si distribuiscono su tre tier, e il kit oggi presidia bene solo il cuore del terzo:

1. **Editoriale** (framer.com, poch.studio): View Transitions API, appear effects, video, tipografia. Zero 3D.
2. **Motion-craft** (ylem.watch): GSAP+Lenis disciplinati su CMS. 6,6 KB di regia → nomination Awwwards.
3. **3D pieno** (threejs.paris): WebGPU + TSL + compute + KTX2 + fisica in worker + anime/DOM.

Un «sito moderno luglio 2026» è la coreografia di tutti e tre. Il kit deve saperli comporre, non solo eseguire il tier 3.

## Mappa completa delle variabili (have / gap)

| # | Variabile | I siti veri (evidenza) | Kit oggi | Gap | Priorità |
|---|---|---|---|---|---|
| 1 | Renderer + shader | WebGPU+TSL+compute (threejs.paris) | three 0.184, TSL, 6 agenti, skill | ricette compute/bit-packing/tiering runtime (ROADMAP li ha in NEXT/LATER) | P1 |
| 2 | Registro di sezioni componibili | Relume 1000+, Flowkit, shadcn | **0/12 blueprint, `/registry` non esiste** | il gap n°1: gli agenti reinventano ogni volta | **P0** |
| 3 | Pipeline a stadi + artefatti | sitemap→wireframe→style (Relume) | **niente** brief/ storyboard content/ PIPELINE_STATUS | 6 agenti di processo + 4 skill del playbook §5-6 | **P0** |
| 4 | Loop QA visiva | Lovable/Bolt vedono la preview | skill qa-visivo globale, **nessuno script**, `qa/` assente | `shoot.mjs` (sezione×breakpoint) + ciclo max-3-giri | **P0** |
| 5 | Pipeline asset come comandi | KTX2 ETC1S atlas (threejs.paris) | prosa ottima, **zero codice**: no encode-assets, no `/public/basis` `/draco` `/hdri`, no manifest | script gltf-transform + transcoder + `approved-sources.json` | **P0** |
| 6 | Gate perf numerici | 120fps target, adaptive (threejs.paris) | rubrica auditor, tier hook fragile; r3f-perf non installato | `perf-check.mjs` + budget come gate, non consigli | P0/P1 |
| 7 | Framework sito cliente | poster LCP, route, font (genere) | **Vite SPA one-pager** (lab) | starter **Next App Router** gemello (playbook §3) | **P1** |
| 8 | Transizioni di pagina | **View Transitions API** (framer.com, poch) | niente router, niente VT | pattern VT + blueprint sipario WebGL | P1 |
| 9 | Scenografia scroll | scena unica che si trasforma (ORYZO) | scroll-motion-engineer sa farlo | pattern camera-director codificato + storyboard che lo guida | P1 |
| 10 | Tipografia cinetica + display type | SplitText 2025, Chillax/Season (recon font) | GSAP ha tutto; 30 Google fonts in lib/ | blueprint kinetic-type; scaffale **Fontshare per-progetto** (add-font.mjs esteso); scala clamp nei token | P1 |
| 11 | Token unici DOM↔canvas | direction→tokens→theme+uniform | niente | script token-bridge (direction.md → CSS vars + uniform TSL) | P1 |
| 12 | Preloader progresso reale | standard del genere | assente | blueprint 01 (useProgress + sipario) | P1 |
| 13 | Fisica | custom in Web Worker (threejs.paris) | **rapier non è dipendenza** (ROADMAP NEXT) | @react-three/rapier + pattern worker-springs per folle | P1 |
| 14 | Micro-interazioni | cursori, magnetic, scramble | React Bits 134 + interaction-engineer ✓ | solo audit per-componente (hazard `getAll().kill()` già noto) | P2 |
| 15 | SEO / LCP / CWV | poster server-rendered vince LCP | SPA senza poster reale | arriva col Next starter + script poster (ROADMAP LATER) | P1/P2 |
| 16 | GDPR / consent / analytics | Complianz su ylem | self-host asset ✓; **nessun pattern consent/analytics** | pattern first-party (Plausible self-host o simili) + gate consenso | P2 |
| 17 | Deploy | Vercel (playbook) | canone Lorenzo: **Cloudflare Pages via token** (collaudato) | standardizzare CF Pages; Vercel solo se il cliente richiede Next-ISR | P2 |
| 18 | Variante «CMS ospite» | ylem: 6,6KB su WP/Woo | assente | bundle GSAP+Lenis+token per WP/Shopify — nuovo tier commerciale | P2 |
| 19 | Sound design | comune nel genere (non verificato nel recon) | assente | toggle audio + WebAudio minimale; solo quando un brief lo chiede | P3 |
| 20 | Ricognizione continua | — | **fingerprint fatto oggi** (`scripts/recon-fingerprint.mjs`) ✓ | manca solo il passo visivo (screenshot per sezione) → si fonde con `shoot.mjs` | P2 |

Non-gap espliciti (decisi, non dimenticati): anime.js fuori dal core (GSAP unico motore); Theatre.js no (secondo paradigma inutile); locomotive/Barba/framer-motion-3d banditi; pmndrs postprocessing evitato su WebGPU; Gaussian splats in R&D.

## Il rapporto con ROADMAP.md

ROADMAP.md copre magistralmente **l'asse verticale** (realismo del rendering: IBL, PBR, instancing, post, fisica) con correzioni verificate. Questo documento aggiunge **l'asse orizzontale** (sistema produttivo: registro, pipeline, QA, cliente). Non si sostituiscono: si sequenziano. I fix «NOW» della ROADMAP restano il primo passo perché alzano il pavimento di qualità su cui i blueprint verranno costruiti.

## Sequenza raccomandata (netta)

- **Settimana 1 — pavimento tecnico**: i punti NOW della ROADMAP (contraddizione post-FX, KTX2+IBL, AgX, CI vera, hazard ScrollReveal, tier robusto) + `encode-assets.mjs` + `/public/{basis,draco,hdri}` + r3f-perf. Ciò che ogni blueprint consumerà.
- **Settimana 2 — sistema produttivo**: `PIPELINE_STATUS.md`, cartelle brief/content/qa, i 6 agenti di processo e le 4 skill del playbook, token-bridge, `shoot.mjs` + `perf-check.mjs`.
- **Settimane 3-4 — primi blueprint + prova del loop**: 01 preloader, 02 hero-3d-split, 03 mesh-gradient-field, 05 pinned-scene-scrub, 06 kinetic-type su una demo one-page; QA loop fino a report pulito; gate perf coi numeri.
- **Poi**: starter Next gemello + transizioni VT; blueprint restanti a trascinamento dei progetti reali; `instanced-crowd-physics` come showcase quando c'è un cliente che lo giustifica.

Con questo in piedi, il target del playbook (one-pager tipo ORYZO in 3-5 giorni) diventa credibile; oggi non lo è perché ogni progetto riparte dall'implementazione.

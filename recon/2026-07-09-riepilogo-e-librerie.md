# Riepilogo ricognizione 9 luglio 2026 + verdetti librerie

Prima esecuzione del modulo di ricognizione (playbook §9). Strumento: `scripts/recon-fingerprint.mjs` (fingerprint statico: HTML + bundle livello 1 e 2, ~50 firme). Report per dominio in questa cartella.

## Quadro

| Sito | Base | Motion | 3D | Transizioni |
|---|---|---|---|---|
| framer.com | Framer stesso (dogfooding), React 18.2 | runtime Framer + appear effects | no (compositor 2D GLSL "Shaders") | **View Transitions API** |
| threejs.paris | Vue 3 + Vite | **anime.js v4** | **three.js WebGPU + TSL + compute**, KTX2 ETC1S | in-scene (sito one-page) |
| poch.studio | Framer | runtime Framer | no (video webm/mp4) | View Transitions API |
| ylem.watch | WordPress + WooCommerce | **GSAP 3.12.2 + Lenis** nel tema | no in home | reload classico + regia GSAP |

Pattern emerso: **nessuno dei quattro usa tutta la pila insieme**. Il genere si stratifica in tier — editoriale (Framer/VT), motion-craft (GSAP+Lenis su CMS), 3D pieno (WebGPU+TSL). Il kit copre il tier 3 e può scendere ai tier 1-2 a costo marginale; i builder non possono salire.

## Verdetti librerie segnalate

- **React Bits (reactbits.dev)** — già vendorizzata nel kit (134 componenti in `lib/react-bits/`). Il loro sito conferma il posizionamento: Vite React SPA con gsap/ScrollTrigger/SplitText/lenis/three/R3F. Azione: solo risincronizzare il catalogo ogni 1-2 mesi.
- **anime.js v4 (animejs.com, sito su v4.5.0)** — MIT, leggera, API v4 (`createTimeline`/`createScope`/`onScroll`). Usata in produzione da threejs.paris; il proprio sito la accoppia a three r172 + GLB Draco/Meshopt/KTX2. **Verdetto netto: NON entra nel core del kit.** GSAP resta l'unico motore (regola "one RAF loop, one owner"; ScrollTrigger non ha pari su pin/scrub). Ammessa solo in isole/embed dove GSAP è sproporzionato. Vietato mischiarle nello stesso scroll.
- **Framer Shaders** — catalogo di preset 2D (gradienti, liquid glass, ripple cursor-reactive, dithering, ASCII) da usare come **riferimento di naming e parametri** per il tsl-gradient-cookbook, non come dipendenza.

## Backlog registro (dal giro)

1. `instanced-crowd-physics` (da threejs.paris) — sforzo alto, riuso altissimo.
2. `pointer-ripple-image` (da Framer Shaders) — ricetta TSL, 1-2 gg.
3. Tecnica bit-packing attributi d'istanza → skill tsl-shader-engineer.
4. `organic-svg-buttons` (48 control point, cursor-reactive) → interaction-engineer.
5. Variante deploy "CMS ospite" (da ylem.watch) — quando arriva il primo cliente così.

## Limiti del pass e come usare lo strumento

Pass statico: niente screenshot né runtime (il catalogo visivo delle sezioni si completa con `shoot.mjs`/Chrome quando un sito merita il secondo livello). Uso: `RECON_OUT=recon/cache-run node scripts/recon-fingerprint.mjs https://sito1 https://sito2` — poi grep mirati sulla cache per versioni e contesti.

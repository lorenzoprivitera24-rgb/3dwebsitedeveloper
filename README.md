# web3d-2026-starter

Scaffold di un sito 3D in cui la forma si deforma allo scroll (desktop) e al tocco (mobile),
generato dall'agent `r3f-scene-architect`. Stack giugno 2026: WebGPU + TSL, React Three Fiber v9
su React 19, GSAP 3.13+ (ora gratuito), Lenis, Motion per la UI.

## Avvio

```bash
npm install

# consigliato subito dopo l'install: porta lo stack all'ultima stabile
# (i numeri in package.json sono un floor verificato, WebGPU e zero-config da three r171)
npm i three@latest @react-three/fiber@latest gsap@latest @gsap/react@latest lenis@latest motion@latest

npm run dev
```

Apri l'URL che stampa Vite. Scorri la pagina e muovi il cursore sulla forma. Su telefono, trascina il dito.

## Cosa fa, in breve

- `Canvas` con renderer WebGPU inizializzato in modo asincrono (`await renderer.init()`), con
  fallback automatico a WebGL2. Se manca anche WebGL, compare un poster statico al posto del canvas.
- Un solo loop: Lenis guidato da `gsap.ticker`, ScrollTrigger aggiornato da Lenis.
- Lo scroll scrive un progresso `0..1` in un ref (niente re-render per frame).
- La forma (`MorphingForm`) è uno shader TSL che si deforma da due segnali smorzati: scroll e pointer.
  Mouse e touch sono unificati da `state.pointer` di R3F.
- Overlay DOM con Motion, parallax in sync, percorso `prefers-reduced-motion`.
- Tier di qualita (low/medium/high) che abbassa suddivisione e ampiezza su mobile.

## Mappa file

```
ARCHITECTURE.md                    il contratto condiviso (leggilo prima di estendere)
src/
  App.tsx                          assembla scroll + canvas/poster + overlay
  main.tsx                         entry React 19
  styles.css                       tema dark editoriale, layer fisso, track di scroll
  lib/webgl.ts                     supportsWebGL -> canvas vs poster
  hooks/useReducedMotion.ts        prefers-reduced-motion live
  hooks/useQualityTier.ts          tier di qualita da viewport/touch/memoria
  scroll/SmoothScroll.tsx          ReactLenis + sync gsap.ticker (loop singolo)   [architect]
  scroll/ScrollProgressDriver.tsx  ScrollTrigger -> ref di progresso              [motion]
  canvas/Stage.tsx                 Canvas WebGPU async + extend + error boundary  [architect]
  canvas/Scene.tsx                 luci + rig + forma                             [architect]
  canvas/CameraRig.tsx             camera dallo scroll                            [motion]
  canvas/MorphingForm.tsx          shader TSL displacement scroll + pointer       [shader + motion]
  canvas/Poster.tsx                fallback no-WebGL                              [architect/ui]
  ui/Overlay.tsx                   UI DOM con Motion + parallax + a11y            [ui]
```

## Usarlo con gli agent del kit

Questo progetto e pensato per essere lavorato dai sub-agent di `web3d-2026-kit`. Per attivarli:

1. Copia in questa cartella la directory `.claude/` del kit (con `agents/` e
   `skills/web3d-integration-patterns/`).
2. Apri la cartella con Claude Code (desktop Mac), lancia `/agents` per confermare il caricamento.
3. Estendi seguendo i punti marcati nel codice e in `ARCHITECTURE.md`, ad esempio:
   ```
   Usa tsl-shader-engineer per arricchire MorphingForm: aggiungi ottave di rumore,
   un colorNode cromatico e, se il device e WebGPU, un campo di particelle in compute.
   ```
   ```
   Usa scroll-motion-engineer per trasformare ScrollProgressDriver in una timeline GSAP
   con sezioni pinnate e taratura del damping per mobile.
   ```
   ```
   Usa ui-overlay-a11y-engineer per costruire le sezioni reali, nav e CTA, con pass completo
   di responsivita e accessibilita.
   ```
   ```
   Fai un audit con perf-fallback-auditor prima del rilascio.
   ```

## Note tecniche

- `framer-motion-3d` NON e usato: discontinuato e incompatibile con React 19. Il 3D si anima con
  `useFrame` + `MathUtils.damp`; Motion (`motion/react`) resta confinato alla UI in DOM.
- Verifica sempre le versioni installate (`npm ls three @react-three/fiber`) invece di affidarti ai
  numeri in package.json: lo stack evolve, ma ruoli e regole in `ARCHITECTURE.md` restano validi.
- StrictMode doppio-monta in dev; useGSAP e ReactLenis gestiscono il cleanup, quindi e atteso.

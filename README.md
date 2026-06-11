# live-city-sim

Simulatore di citta dal vivo, stile realistico: un'app 3D a tutto schermo con citta procedurale a
griglia, ciclo giorno/notte continuo e traffico. Scaffold generato dall'agent `r3f-scene-architect`.
Stack giugno 2026: WebGPU + TSL, React Three Fiber v9 su React 19, Motion per la UI. Niente scroll,
niente Lenis: il loop per-frame e quello di R3F (`useFrame`).

## Avvio

```bash
npm install
npm run dev
```

Apri l'URL che stampa Vite. Trascina per orbitare la camera (mouse o dito), rotella per lo zoom.
Usa il pannello in alto a sinistra per play/pausa, velocita, ora del giorno e qualita.

## Cosa fa, in breve

- `Canvas` con renderer WebGPU inizializzato in modo asincrono (`await renderer.init()`), fallback
  automatico a WebGL2. Senza WebGL compare un poster statico al posto del canvas.
- Un solo driver per-frame: il loop interno di R3F. `SimClockDriver` (un solo `useFrame`) avanza
  l'orologio della simulazione e guida sole, cielo, nebbia e gli uniform condivisi.
- Citta generata in modo deterministico da un seed: blocchi, edifici come `InstancedMesh` (3
  archetipi), strade, marciapiedi, corsie per il traffico.
- Edifici, strade e auto sono istanziati (poche draw call). I materiali sono placeholder
  `MeshStandardNodeMaterial`: lo shader engineer li sostituisce con PBR procedurale in TSL.
- Camera a orbita smorzata e vincolata (min/max distanza, angolo polare che non scende sotto terra),
  touch-friendly. Il motion engineer ne tara la sensazione.
- Tier di qualita (low/medium/high) che scala dimensione citta, numero auto, ombre e dpr.
- `prefers-reduced-motion`: il ciclo giorno/notte si congela ma il pannello resta operabile.

## Mappa file

```
ARCHITECTURE.md                  il contratto condiviso (leggilo prima di estendere)
src/
  App.tsx                        SimClockProvider + override qualita + seed + shell
  main.tsx                       entry React 19
  styles.css                     tema dark, layer canvas a tutto schermo, pannello
  lib/webgl.ts                   supportsWebGL -> canvas vs poster
  hooks/useReducedMotion.ts      prefers-reduced-motion live
  hooks/useQualityTier.ts        tabella tier (griglia/auto/ombre/dpr) + override
  sim/SimClock.tsx               orologio sim: ref + API imperativa (context)        [architect]
  sim/SimClockDriver.tsx         IL proprietario del tempo: avanza clock, sole, uniform [architect]
  sim/uniforms.ts                gli uniform TSL condivisi (un solo scrittore)        [architect->shader]
  sim/sun.ts                     dayPhase -> direzione/colore sole + colore cielo (puro)
  city/types.ts                  contratto dati citta (solo dati, niente three.js)    [architect]
  city/generateCity.ts           generatore layout PURO con seed (mulberry32)         [architect]
  city/buildCarInstances.ts      distribuzione auto -> buffer per-istanza + formula   [architect]
  city/Buildings.tsx             3 archetipi istanziati + attr aFacade                [architect->shader]
  city/Ground.tsx                suolo/strade/marciapiedi istanziati                  [architect->shader]
  city/Traffic.tsx               auto istanziate + attr corsie (moto in TSL)          [architect->shader]
  camera/CameraRig.tsx           orbita smorzata vincolata (skeleton)                 [architect->motion]
  canvas/Stage.tsx               Canvas WebGPU async + extend + error boundary        [architect]
  canvas/Scene.tsx               assembla citta + sim + camera                        [architect]
  canvas/RendererConfig.tsx      ACES tone mapping + shadow map                       [architect]
  canvas/Lighting.tsx            fill hemisphere + ambient (il sole e nel driver)     [architect]
  canvas/Poster.tsx              fallback no-WebGL                                    [architect/ui]
  ui/ControlPanel.tsx            pannello DOM accessibile (contratto provato)         [architect->ui]
```

## Usarlo con gli agent del kit

Estendi seguendo i punti marcati nel codice e in `ARCHITECTURE.md`, ad esempio:

```
Usa tsl-shader-engineer per sostituire i materiali placeholder con PBR procedurale: facciate con
finestre illuminate di notte (da aFacade + uDayPhase), asfalto con strisce, e la moto delle auto nel
positionNode (da uTime + gli attributi per-istanza). Aggiungi un SkyMesh procedurale su uSunDirection.
```
```
Usa scroll-motion-engineer (qui: motion engineer) per tarare la camera: damping, parallax sul
pointer, drift cinematico in idle, limiti di zoom, eventuale fly-to one-shot con GSAP.
```
```
Usa ui-overlay-a11y-engineer per disegnare il pannello reale (tema, slider densita traffico, seed),
con pass completo di responsivita e accessibilita.
```
```
Fai un audit con perf-fallback-auditor prima del rilascio.
```

## Note tecniche

- `framer-motion-3d` NON e usato (discontinuato, incompatibile con React 19). Il 3D si anima con
  `useFrame` + `MathUtils.damp` o in TSL; Motion (`motion/react`) resta confinato alla UI in DOM.
- Un solo loop per-frame = R3F. GSAP e tenuto solo per tween one-shot su valori che nessun altro
  guida per frame (es. un fly-to della camera). Mai due sistemi sulla stessa proprieta.
- `three` e fissato a `0.184.x` per combaciare con la checkout di riferimento in `./three.js`
  (sola lettura, NON importarla nel codice: l'app usa solo il pacchetto npm).
- `npm run build` (= `tsc -b && vite build`) deve passare. La cartella `three.js/` resta fuori dalla
  build dell'app (tsconfig include solo `src`).

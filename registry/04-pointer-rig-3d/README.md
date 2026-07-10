# 04 · pointer-rig-3d

Un satellite della forma, sulla scena persistente, che insegue il puntatore con un ritardo
misurato e un tilt sottile: la pagina "si accorge" di te senza mai strapparti la camera.

## Contratto

- **Props**: `copy` (PointerCopy: eyebrow/headline/body) + `reduced` — vedi `meta.json`.
  I colori del satellite arrivano SOLO dai token (`TOKENS.colors.bg2` base,
  `TOKENS.gradient.c` emissive); niente valori visivi inline.
- **Copy**: slot esatti in `content/04-pointer.json` (`eyebrow`, `headline`, `body`).
- **Scena condivisa**: il lato DOM scrive SOLO `progressMap.pointer` via `useSectionProgress`.
  Il lato scena (`RigSatellite`, montato dentro `Stage` accanto a `Scene`) NON scrive camera
  né `sceneTargets`: calcola i propri target (posizione/tilt/presenza) e li dampa nel proprio
  `useFrame` — unico owner del gruppo. Il CameraDirector resta l'unico scrittore di camera;
  in questa sezione la camera tiene la posa calma ereditata dal capitolo `kinetic`
  (testimone esplicito: nessun capitolo nuovo richiesto).

## Struttura file

```
registry/04-pointer-rig-3d/
  meta.json          ← contratto machine-readable
  README.md          ← questo file
  PointerRig3d.tsx   ← la sezione DOM (pannello sticky eyebrow+headline+body)
  RigSatellite.tsx   ← il rig sulla scena persistente (perfTier B: 2 draw call, 1 materiale)
```

## Tier & fallback

| Tier | Comportamento |
|---|---|
| desktop | il satellite insegue il puntatore (listener `pointermove` a livello window → ref; damp λ=5) con tilt ±0.3/0.45 rad e bob leggero; presenza gated dal progress della sezione |
| mobile | `(pointer: coarse)`: l'inseguimento passa allo scroll progress della sezione (traversata sinistra→destra + arco verticale, damp identico); **nessun gyro in v1**; lo span si ricava dal frustum reale, il rig non esce mai di scena sui viewport stretti |
| reduced-motion | rig fermo in posa composta (offset destro, tilt fisso), niente bob né spin dell'anello; entra/esce con un fade lento di sezione |
| WebGL2 | nessuna feature WebGPU-only: `MeshStandardNodeMaterial` senza nodi custom compila su entrambi i backend |

## Note di implementazione

- **Perché non `state.pointer`**: l'overlay DOM (`.content`, z-index 1) copre il canvas fixed,
  quindi gli eventi pointer non raggiungono l'elemento canvas e `state.pointer` resta fermo
  (verificato con `document.elementFromPoint` sulla demo composta). Il rig legge quindi
  `pointermove` a livello window, in un ref passivo; il damping resta nel suo `useFrame`
  (un solo RAF, regola #3 del kit).
- **React Bits consultato**: gli effetti cursor-follow del catalogo (Magnet, Blob Cursor,
  Ghost Cursor, Target Cursor…) sono DOM-layer; questo blueprint vive sulla scena WebGPU
  persistente → implementazione nativa R3F, pattern damp identico al resto della scena.
- **Budget dichiarato**: +2 draw call (icosaedro detail 3 + torus), 1 materiale condiviso,
  0 KB di asset, ~5 KB di sorgente; `visible=false` fuori sezione (nessun costo GPU residuo).

## Checklist di promozione

- [x] Props parametrizzate dai token (zero valori inline: colori da `TOKENS`)
- [x] Slot copy documentati e consumati da `content/04-pointer.json`
- [x] `progressMap`/camera: ownership dichiarata sopra, nessun secondo scrittore
- [x] Tier mobile + reduced-motion implementati e VISTI (`npm run qa:shoot` + scatti emulati coarse-pointer e reduced-motion)
- [x] Budget: contributo draw calls/KB dichiarato sopra; `npm run perf:check` verde
- [x] Lint pulito (`npm run lint`), niente `framer-motion-3d`, niente RAF extra

Uso: `<PointerRig3d copy={pointerJson} reduced={reduced} />` nel flusso DOM +
`<RigSatellite reduced={reduced} />` dentro `Stage` (stessa scena, stesso loop),
con `content/04-pointer.json`.

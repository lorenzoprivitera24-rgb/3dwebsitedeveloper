# NN-nome-blueprint

[Una frase: il momento che questa sezione regala all'utente.]

## Contratto

- **Props**: dalla tabella di `meta.json` — ogni valore visivo arriva dai token
  (`src/lib/tokens.generated.ts`), MAI hardcoded (regola blueprint-librarian).
- **Copy**: slot esatti in `content/NN-nome.json` (li definisce copy-chief in S3).
- **Scena condivisa**: cosa scrive in `progressMap` (solo la propria chiave via
  `useSectionProgress`) e quali capitoli/keyframe registra nel `CameraDirector` (che resta
  l'unico scrittore di camera). Un solo owner per proprietà.

## Struttura file

```
registry/NN-nome-blueprint/
  meta.json        ← contratto machine-readable (dal template _template/meta.json)
  README.md        ← questo file
  Section.tsx      ← la sezione DOM (+ eventuali sotto-componenti)
  scene.ts(x)      ← SOLO se perfTier C: i target/keyframe che il blueprint dà alla scena
```

## Tier & fallback

| Tier | Comportamento |
|---|---|
| desktop | [firma completa] |
| mobile | [cosa scala: densità/ampiezza/pin ridotto — MAI la narrativa] |
| reduced-motion | [equivalente statico dignitoso] |
| WebGL2 | [se usa feature WebGPU-only: fallback dichiarato] |

## Checklist di promozione (spuntare TUTTA prima di aggiornare INDEX.md)

- [ ] Props parametrizzate dai token (zero valori inline)
- [ ] Slot copy documentati e consumati da `content/*.json`
- [ ] `progressMap`/camera: ownership dichiarata sopra, nessun secondo scrittore
- [ ] Tier mobile + reduced-motion implementati e VISTI (`npm run qa:shoot`)
- [ ] Budget: contributo draw calls/KB dichiarato; `npm run perf:check` verde
- [ ] Lint pulito (`npm run lint`), niente `framer-motion-3d`, niente RAF extra

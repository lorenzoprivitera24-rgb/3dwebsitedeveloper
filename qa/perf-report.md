# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- **JS iniziale: 163.1 KB gzip** (target 150 · cap 300) — entry + import statici, ciò
  che il browser scarica prima del primo frame
- JS su richiesta: 1375.7 KB gzip (canvas/three dietro il confine dinamico)
- JS totale: 1538.9 KB gzip (warn > 700)
- CSS: 12.3 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 163.1 KB gzip > target 150 KB
- JS totale 1538.9 KB gzip > 700 KB (il peso è rimandato, non tolto)

## Motore rapier, solo dietro un import() di rapier stesso
- motore: react-three-rapier.esm-CzT2yMKR.js (818.5 KB gzip), riconosciuto dalla firma del WASM
- chunk di rapier stesso, esenti: @react-three/rapier/dist/react-three-rapier.esm.js, @dimforge/rapier3d-compat/rapier.mjs
- senza motore nel grafo statico: katex/dist/katex.mjs, index.html, src/canvas/CanvasLayer.tsx, src/lab/CompilazioneLab.tsx, src/lab/CostantiLab.tsx, src/lab/IblLab.tsx, src/lab/IndiciLab.tsx, src/lab/RealismLab.tsx

## File della build
| file | percorso | raw | gzip |
|---|---|---|---|
| index-CX4FwIwJ.js | **iniziale** | 492.8 KB | 162.7 KB gzip |
| index-D7HzY3MY.css | **iniziale** | 20 KB | 4.5 KB gzip |
| rolldown-runtime-hePW80VL.js | **iniziale** | 0.7 KB | 0.4 KB gzip |
| CanvasLayer-jKdk3HSU.js | su richiesta | 13.6 KB | 5.6 KB gzip |
| CompilazioneLab-DgwqN9D2.js | su richiesta | 1.1 KB | 0.7 KB gzip |
| CostantiLab-OK4oJGD_.js | su richiesta | 1.6 KB | 0.9 KB gzip |
| Environment-DbD68BO0.js | su richiesta | 49.6 KB | 17.6 KB gzip |
| IblLab-Drd64fQA.js | su richiesta | 2.9 KB | 1.5 KB gzip |
| IndiciLab-CB3ixyRW.js | su richiesta | 1.3 KB | 0.7 KB gzip |
| RealismLab-DNewgmCT.js | su richiesta | 6.8 KB | 3 KB gzip |
| Stage-BJj1fAdL.js | su richiesta | 159.9 KB | 50.7 KB gzip |
| katex-CiJ_n4H9.js | su richiesta | 252.6 KB | 75.1 KB gzip |
| katex-Ddr6Z9Sf.css | su richiesta | 29 KB | 7.8 KB gzip |
| rapier-8XAwP5-D.js | su richiesta | 2.7 KB | 1.2 KB gzip |
| react-three-rapier.esm-CzT2yMKR.js | su richiesta | 2207.9 KB | 818.5 KB gzip |
| three-CsdZyS-T.js | su richiesta | 1427 KB | 399.8 KB gzip |
| wind-DHccDF-z.js | su richiesta | 1.1 KB | 0.6 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

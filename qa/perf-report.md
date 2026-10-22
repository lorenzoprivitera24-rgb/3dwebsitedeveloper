# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- **JS iniziale: 163.1 KB gzip** (target 150 · cap 300) — entry + import statici, ciò
  che il browser scarica prima del primo frame
- JS su richiesta: 1400.1 KB gzip (canvas/three dietro il confine dinamico)
- JS totale: 1563.2 KB gzip (warn > 700)
- CSS: 12.3 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 163.1 KB gzip > target 150 KB
- JS totale 1563.2 KB gzip > 700 KB (il peso è rimandato, non tolto)

## Motore rapier, solo dietro un import() di rapier stesso
- motore: react-three-rapier.esm-DSWEJmpa.js (818.1 KB gzip), riconosciuto dalla firma del WASM
- chunk di rapier stesso, esenti: @react-three/rapier/dist/react-three-rapier.esm.js, @dimforge/rapier3d-compat/rapier.mjs
- senza motore nel grafo statico: katex/dist/katex.mjs, index.html, src/canvas/CanvasLayer.tsx, src/lab/CompilazioneLab.tsx, src/lab/CostantiLab.tsx, src/lab/IblLab.tsx, src/lab/IndiciLab.tsx, src/lab/RealismLab.tsx

## File della build
| file | percorso | raw | gzip |
|---|---|---|---|
| index-D7HzY3MY.css | **iniziale** | 20 KB | 4.5 KB gzip |
| index-DnZGqiSU.js | **iniziale** | 492.9 KB | 162.7 KB gzip |
| rolldown-runtime-hePW80VL.js | **iniziale** | 0.7 KB | 0.4 KB gzip |
| CanvasLayer-Czeqrk0X.js | su richiesta | 13.6 KB | 5.6 KB gzip |
| CompilazioneLab-DPYTgaO0.js | su richiesta | 1.1 KB | 0.7 KB gzip |
| CostantiLab-CiqL0MCC.js | su richiesta | 1.6 KB | 0.9 KB gzip |
| Environment-3f5gbrn0.js | su richiesta | 49.6 KB | 17.6 KB gzip |
| IblLab-BuHK5pu_.js | su richiesta | 2.9 KB | 1.5 KB gzip |
| IndiciLab-BypV3_pz.js | su richiesta | 1.3 KB | 0.7 KB gzip |
| RealismLab-D_jj6Ncy.js | su richiesta | 87.9 KB | 27.5 KB gzip |
| Stage-DQAh4LjO.js | su richiesta | 160.2 KB | 50.8 KB gzip |
| katex-CiJ_n4H9.js | su richiesta | 252.6 KB | 75.1 KB gzip |
| katex-Ddr6Z9Sf.css | su richiesta | 29 KB | 7.8 KB gzip |
| rapier-whCv5K3j.js | su richiesta | 2.7 KB | 1.2 KB gzip |
| react-three-rapier.esm-DSWEJmpa.js | su richiesta | 2206.8 KB | 818.1 KB gzip |
| three-BPD8enkp.js | su richiesta | 1427.3 KB | 400 KB gzip |
| wind-BPheAUhU.js | su richiesta | 1.1 KB | 0.6 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

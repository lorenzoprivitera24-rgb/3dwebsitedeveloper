# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- **JS iniziale: 162.9 KB gzip** (target 150 · cap 300) — entry + import statici, ciò
  che il browser scarica prima del primo frame
- JS su richiesta: 1368.7 KB gzip (canvas/three dietro il confine dinamico)
- JS totale: 1531.6 KB gzip (warn > 700)
- CSS: 12.3 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 162.9 KB gzip > target 150 KB
- JS totale 1531.6 KB gzip > 700 KB (il peso è rimandato, non tolto)

## Motore rapier, solo dietro un import() di rapier stesso
- motore: react-three-rapier.esm-CTLtmcqZ.js (818.5 KB gzip), riconosciuto dalla firma del WASM
- chunk di rapier stesso, esenti: @react-three/rapier/dist/react-three-rapier.esm.js, @dimforge/rapier3d-compat/rapier.mjs
- senza motore nel grafo statico: katex/dist/katex.mjs, index.html, src/canvas/CanvasLayer.tsx, src/lab/RealismLab.tsx

## File della build
| file | percorso | raw | gzip |
|---|---|---|---|
| index-CLqUgkVj.js | **iniziale** | 492.1 KB | 162.5 KB gzip |
| index-D7HzY3MY.css | **iniziale** | 20 KB | 4.5 KB gzip |
| rolldown-runtime-hePW80VL.js | **iniziale** | 0.7 KB | 0.4 KB gzip |
| CanvasLayer-Cg50xHkp.js | su richiesta | 11 KB | 4.5 KB gzip |
| Environment-CN0NdyYF.js | su richiesta | 205.5 KB | 66.4 KB gzip |
| RealismLab-8mCJCxQB.js | su richiesta | 7.8 KB | 3.4 KB gzip |
| katex-CiJ_n4H9.js | su richiesta | 252.6 KB | 75.1 KB gzip |
| katex-Ddr6Z9Sf.css | su richiesta | 29 KB | 7.8 KB gzip |
| rapier-CgLooMiB.js | su richiesta | 2.7 KB | 1.2 KB gzip |
| react-three-rapier.esm-CTLtmcqZ.js | su richiesta | 2207.9 KB | 818.5 KB gzip |
| three-B9rs6YBT.js | su richiesta | 1427 KB | 399.7 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

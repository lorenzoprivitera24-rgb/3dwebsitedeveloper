# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- **JS iniziale: 162.9 KB gzip** (target 150 · cap 300) — entry + import statici, ciò
  che il browser scarica prima del primo frame
- JS su richiesta: 1393 KB gzip (canvas/three dietro il confine dinamico)
- JS totale: 1556 KB gzip (warn > 700)
- CSS: 12.3 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 162.9 KB gzip > target 150 KB
- JS totale 1556 KB gzip > 700 KB (il peso è rimandato, non tolto)

## Motore rapier, solo dietro un import() di rapier stesso
- motore: react-three-rapier.esm-DWoxSZk5.js (818.1 KB gzip), riconosciuto dalla firma del WASM
- chunk di rapier stesso, esenti: @react-three/rapier/dist/react-three-rapier.esm.js, @dimforge/rapier3d-compat/rapier.mjs
- senza motore nel grafo statico: katex/dist/katex.mjs, index.html, src/canvas/CanvasLayer.tsx, src/lab/RealismLab.tsx

## File della build
| file | percorso | raw | gzip |
|---|---|---|---|
| index-Bj1C22H-.js | **iniziale** | 492.1 KB | 162.5 KB gzip |
| index-D7HzY3MY.css | **iniziale** | 20 KB | 4.5 KB gzip |
| rolldown-runtime-hePW80VL.js | **iniziale** | 0.7 KB | 0.4 KB gzip |
| CanvasLayer-CvcupOjI.js | su richiesta | 11 KB | 4.5 KB gzip |
| Environment-BQDQiRvq.js | su richiesta | 205.5 KB | 66.4 KB gzip |
| RealismLab-CK5n_jPO.js | su richiesta | 88.9 KB | 27.9 KB gzip |
| katex-CiJ_n4H9.js | su richiesta | 252.6 KB | 75.1 KB gzip |
| katex-Ddr6Z9Sf.css | su richiesta | 29 KB | 7.8 KB gzip |
| rapier-BbK6xUo3.js | su richiesta | 2.7 KB | 1.2 KB gzip |
| react-three-rapier.esm-DWoxSZk5.js | su richiesta | 2206.9 KB | 818.1 KB gzip |
| three-EJnKwP7i.js | su richiesta | 1427.3 KB | 399.9 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

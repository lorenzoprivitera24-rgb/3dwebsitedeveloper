# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- **JS iniziale: 163.1 KB gzip** (target 150 · cap 300) — entry + import statici, ciò
  che il browser scarica prima del primo frame
- JS su richiesta: 1375.5 KB gzip (canvas/three dietro il confine dinamico)
- JS totale: 1538.6 KB gzip (warn > 700)
- CSS: 12.3 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 163.1 KB gzip > target 150 KB
- JS totale 1538.6 KB gzip > 700 KB (il peso è rimandato, non tolto)

## File della build
| file | percorso | raw | gzip |
|---|---|---|---|
| index-Cq5zGfAt.js | **iniziale** | 492.8 KB | 162.7 KB gzip |
| index-D7HzY3MY.css | **iniziale** | 20 KB | 4.5 KB gzip |
| rolldown-runtime-hePW80VL.js | **iniziale** | 0.7 KB | 0.4 KB gzip |
| CanvasLayer-HkSnxhwy.js | su richiesta | 13.6 KB | 5.6 KB gzip |
| CompilazioneLab-C1tsozLl.js | su richiesta | 1.1 KB | 0.7 KB gzip |
| CostantiLab-BN-_TB2O.js | su richiesta | 1.6 KB | 0.9 KB gzip |
| Environment-Bix6o7SB.js | su richiesta | 49.6 KB | 17.6 KB gzip |
| IblLab-ndqVB6yN.js | su richiesta | 2.9 KB | 1.5 KB gzip |
| IndiciLab-KNy4Fpv_.js | su richiesta | 1.3 KB | 0.7 KB gzip |
| RealismLab-Bo06Alvf.js | su richiesta | 6.3 KB | 2.8 KB gzip |
| Stage-gL0S6h5u.js | su richiesta | 159.9 KB | 50.7 KB gzip |
| katex-CiJ_n4H9.js | su richiesta | 252.6 KB | 75.1 KB gzip |
| katex-Ddr6Z9Sf.css | su richiesta | 29 KB | 7.8 KB gzip |
| rapier-DIye6m2N.js | su richiesta | 2.7 KB | 1.2 KB gzip |
| react-three-rapier.esm-C5A2uq3p.js | su richiesta | 2207.9 KB | 818.5 KB gzip |
| three-CsdZyS-T.js | su richiesta | 1427 KB | 399.8 KB gzip |
| wind-DHccDF-z.js | su richiesta | 1.1 KB | 0.6 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

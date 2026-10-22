# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- **JS iniziale: 163.1 KB gzip** (target 150 · cap 300) — entry + import statici, ciò
  che il browser scarica prima del primo frame
- JS su richiesta: 1372.3 KB gzip (canvas/three dietro il confine dinamico)
- JS totale: 1535.4 KB gzip (warn > 700)
- CSS: 12.3 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 163.1 KB gzip > target 150 KB
- JS totale 1535.4 KB gzip > 700 KB (il peso è rimandato, non tolto)

## File della build
| file | percorso | raw | gzip |
|---|---|---|---|
| index-Cx-qouao.js | **iniziale** | 492.7 KB | 162.7 KB gzip |
| index-D7HzY3MY.css | **iniziale** | 20 KB | 4.5 KB gzip |
| rolldown-runtime-hePW80VL.js | **iniziale** | 0.7 KB | 0.4 KB gzip |
| CanvasLayer-Cv1eo7vg.js | su richiesta | 13.6 KB | 5.6 KB gzip |
| CompilazioneLab-YWRvDkck.js | su richiesta | 1.1 KB | 0.7 KB gzip |
| CostantiLab-CWeqY15j.js | su richiesta | 1.6 KB | 0.9 KB gzip |
| Environment-BF6mi1YZ.js | su richiesta | 49.6 KB | 17.6 KB gzip |
| IndiciLab-BVeeQSHU.js | su richiesta | 1.3 KB | 0.7 KB gzip |
| RealismLab-C6aKb-Mh.js | su richiesta | 2210.5 KB | 819.9 KB gzip |
| Stage-CXF3TBjs.js | su richiesta | 159.1 KB | 50.5 KB gzip |
| katex-CiJ_n4H9.js | su richiesta | 252.6 KB | 75.1 KB gzip |
| katex-Ddr6Z9Sf.css | su richiesta | 29 KB | 7.8 KB gzip |
| rapier-CcCHwC92.js | su richiesta | 2.6 KB | 1.2 KB gzip |
| three-CDt3vOvs.js | su richiesta | 1427 KB | 399.8 KB gzip |
| wind-DLYzX3U5.js | su richiesta | 1.1 KB | 0.6 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

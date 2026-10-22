# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- **JS iniziale: 163.1 KB gzip** (target 150 · cap 300) — entry + import statici, ciò
  che il browser scarica prima del primo frame
- JS su richiesta: 1374 KB gzip (canvas/three dietro il confine dinamico)
- JS totale: 1537.2 KB gzip (warn > 700)
- CSS: 12.3 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 163.1 KB gzip > target 150 KB
- JS totale 1537.2 KB gzip > 700 KB (il peso è rimandato, non tolto)

## File della build
| file | percorso | raw | gzip |
|---|---|---|---|
| index-D7HzY3MY.css | **iniziale** | 20 KB | 4.5 KB gzip |
| index-D7oZQfhd.js | **iniziale** | 492.8 KB | 162.7 KB gzip |
| rolldown-runtime-hePW80VL.js | **iniziale** | 0.7 KB | 0.4 KB gzip |
| CanvasLayer-CrdAim4V.js | su richiesta | 13.6 KB | 5.6 KB gzip |
| CompilazioneLab-D4TN18u9.js | su richiesta | 1.1 KB | 0.7 KB gzip |
| CostantiLab-DB2lmG-z.js | su richiesta | 1.6 KB | 0.9 KB gzip |
| Environment-D7Ro-AVQ.js | su richiesta | 49.6 KB | 17.6 KB gzip |
| IblLab-DNh39eSU.js | su richiesta | 2.9 KB | 1.5 KB gzip |
| IndiciLab-B5qAzs2G.js | su richiesta | 1.3 KB | 0.7 KB gzip |
| RealismLab-BcvUP5qp.js | su richiesta | 2210.5 KB | 819.9 KB gzip |
| Stage-C1myDrlo.js | su richiesta | 159.9 KB | 50.7 KB gzip |
| katex-CiJ_n4H9.js | su richiesta | 252.6 KB | 75.1 KB gzip |
| katex-Ddr6Z9Sf.css | su richiesta | 29 KB | 7.8 KB gzip |
| rapier-B9304btp.js | su richiesta | 2.6 KB | 1.2 KB gzip |
| three-CsdZyS-T.js | su richiesta | 1427 KB | 399.8 KB gzip |
| wind-DHccDF-z.js | su richiesta | 1.1 KB | 0.6 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

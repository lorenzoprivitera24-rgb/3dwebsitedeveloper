# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- **JS iniziale: 162.9 KB gzip** (target 150 · cap 300) — entry + import statici, ciò
  che il browser scarica prima del primo frame
- JS su richiesta: 1367 KB gzip (canvas/three dietro il confine dinamico)
- JS totale: 1529.9 KB gzip (warn > 700)
- CSS: 12.3 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 162.9 KB gzip > target 150 KB
- JS totale 1529.9 KB gzip > 700 KB (il peso è rimandato, non tolto)

## File della build
| file | percorso | raw | gzip |
|---|---|---|---|
| index-D7HzY3MY.css | **iniziale** | 20 KB | 4.5 KB gzip |
| index-DJjH75lo.js | **iniziale** | 492.1 KB | 162.5 KB gzip |
| rolldown-runtime-hePW80VL.js | **iniziale** | 0.7 KB | 0.4 KB gzip |
| CanvasLayer-CaBvul5g.js | su richiesta | 11 KB | 4.5 KB gzip |
| Environment-CWvbI1g-.js | su richiesta | 205.5 KB | 66.4 KB gzip |
| RealismLab-GDvskD7r.js | su richiesta | 2211.4 KB | 820.2 KB gzip |
| katex-CiJ_n4H9.js | su richiesta | 252.6 KB | 75.1 KB gzip |
| katex-Ddr6Z9Sf.css | su richiesta | 29 KB | 7.8 KB gzip |
| rapier-B7Qoxl8q.js | su richiesta | 2.6 KB | 1.2 KB gzip |
| three-B9rs6YBT.js | su richiesta | 1427 KB | 399.7 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

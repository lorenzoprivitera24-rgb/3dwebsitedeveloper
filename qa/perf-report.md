# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- **JS iniziale: 161.5 KB gzip** (target 150 · cap 300) — entry + import statici, ciò
  che il browser scarica prima del primo frame
- JS su richiesta: 431 KB gzip (canvas/three dietro il confine dinamico)
- JS totale: 592.5 KB gzip (warn > 700)
- CSS: 4.1 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 161.5 KB gzip > target 150 KB

## File della build
| file | percorso | raw | gzip |
|---|---|---|---|
| index-AusnI_3B.css | **iniziale** | 17.6 KB | 4.1 KB gzip |
| index-CXqJ3pC5.js | **iniziale** | 488.4 KB | 161.5 KB gzip |
| CanvasLayer-BCwNYdzw.js | su richiesta | 214.3 KB | 69.7 KB gzip |
| three-B-59CwgN.js | su richiesta | 1364.2 KB | 361.3 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- **JS iniziale: 161.5 KB gzip** (target 150 · cap 300) — entry + import statici, ciò
  che il browser scarica prima del primo frame
- JS su richiesta: 431.7 KB gzip (canvas/three dietro il confine dinamico)
- JS totale: 593.2 KB gzip (warn > 700)
- CSS: 4.1 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 161.5 KB gzip > target 150 KB

## File della build
| file | percorso | raw | gzip |
|---|---|---|---|
| index-AusnI_3B.css | **iniziale** | 17.6 KB | 4.1 KB gzip |
| index-BoTuPHLs.js | **iniziale** | 488.4 KB | 161.5 KB gzip |
| CanvasLayer-VcF1vutc.js | su richiesta | 216.2 KB | 70.4 KB gzip |
| three-LYbTXHrb.js | su richiesta | 1364.2 KB | 361.3 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- JS iniziale: **604.8 KB gzip** (target 300 · cap 800)
- CSS: 2 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 604.8 KB gzip > target 300 KB (debito noto: code-split/starter Next — gap analysis)

## File della build
| file | raw | gzip |
|---|---|---|
| index-CXafSeWb.js | 1349.1 KB | 418 KB gzip |
| index-CaRpyx8a.css | 7.5 KB | 2 KB gzip |
| three-C8qGOpvO.js | 720.1 KB | 186.9 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

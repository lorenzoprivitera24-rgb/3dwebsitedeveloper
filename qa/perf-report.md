# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- JS iniziale: **608.1 KB gzip** (target 300 · cap 800)
- CSS: 3.3 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 608.1 KB gzip > target 300 KB (debito noto: code-split/starter Next — gap analysis)

## File della build
| file | raw | gzip |
|---|---|---|
| index-DiKOhLj_.css | 13.7 KB | 3.3 KB gzip |
| index-ObLZu49l.js | 1361.4 KB | 421.3 KB gzip |
| three-C8qGOpvO.js | 720.1 KB | 186.9 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

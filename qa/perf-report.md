# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- JS iniziale: **597 KB gzip** (target 300 · cap 800)
- CSS: 2.1 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 597 KB gzip > target 300 KB (debito noto: code-split/starter Next — gap analysis)

## File della build
| file | raw | gzip |
|---|---|---|
| index-4NVYYE-z.css | 7.8 KB | 2.1 KB gzip |
| index-7CjUnpoA.js | 1321.7 KB | 410.5 KB gzip |
| three-BAyyP-Y6.js | 718.4 KB | 186.5 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

# Perf report — gate S7

Stato: **🟡 VERDE con warn** · Data: (git log della build)

## Totali
- JS iniziale: **595.9 KB gzip** (target 300 · cap 800)
- CSS: 2 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- JS iniziale 595.9 KB gzip > target 300 KB (debito noto: code-split/starter Next — gap analysis)

## File della build
| file | raw | gzip |
|---|---|---|
| index-BgU3uKXn.js | 1318.6 KB | 409.4 KB gzip |
| index-CaRpyx8a.css | 7.5 KB | 2 KB gzip |
| three-1wQWX9Wa.js | 718.4 KB | 186.5 KB gzip |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

# Perf report — gate S7

Stato: **🟢 VERDE** · Data: (git log della build)

## Totali
- JS iniziale (entry + modulepreload): **157.5 KB gzip** (target 300 · cap 800)
- JS differito (chunk caricati dopo il primo paint): 429.7 KB gzip
- JS totale sul disco: 587.2 KB gzip
- CSS: 2.8 KB gzip · GLB: 0 KB (cap 5120)

## FAIL
- nessuno

## Warn
- nessuno

## File della build
| file | raw | gzip | quando |
|---|---|---|---|
| CanvasLayer-o7yB0I-6.js | 210.5 KB | 68.3 KB gzip | differito |
| index-B3O03Oxb.css | 11 KB | 2.8 KB gzip | css |
| index-CVle23qC.js | 473.7 KB | 157.5 KB gzip | INIZIALE |
| three-keaazw1T.js | 1364.2 KB | 361.3 KB gzip | differito |

Nota: LCP/CWV reali si misurano sul deploy (Lighthouse), non qui; questo gate copre pesi e
regressioni. Il fallback WebGPU→WebGL2 e reduced-motion li verifica il perf-fallback-auditor
con qa:verify/qa:shoot.

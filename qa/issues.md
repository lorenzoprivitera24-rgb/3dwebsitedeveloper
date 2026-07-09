# QA issues — demo starter · giro 1 (2026-07-09)

Esito: **PASSA** (zero «blocca»). Backend WebGPU, 0 errori console su 3 breakpoint (report.json).

| Gravità | Sezione | Screenshot | Problema | Fix proposto → a chi |
|---|---|---|---|---|
| bassa | scene-track | `shots/scene-track-390.png` | L'eyebrow «WEBGPU / TSL / R3F V9» perde contrasto dove attraversa il bordo luminoso della sfera (390px) | scrim locale dietro l'eyebrow o `mix-blend-mode: difference` → ui-overlay-a11y-engineer |
| bassa | scene-track | `shots/scene-track-*.png` | L'eyebrow non usa ancora il token `--mono` (Fragment Mono vendorato ma non applicato) | `font-family: var(--mono)` sull'eyebrow → ui-overlay-a11y-engineer |

Formato: una voce per problema · gravità `blocca/alta/bassa` · il QA non corregge, smista.

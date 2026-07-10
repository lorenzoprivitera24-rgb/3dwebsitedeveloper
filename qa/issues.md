# QA issues — demo composta dai blueprint · 2026-07-10

Esito finale: **PASSA al giro 3/3** (regola: max 3 giri). Backend WebGPU, 0 errori console su
15 shot (5 sezioni × 3 breakpoint) in ogni giro.

## Giro 1 → fix
| Gravità | Sezione | Problema | Fix |
|---|---|---|---|
| alta | kinetic | la scena non si calmava quando il testo entra (rampa su tutta la sezione = drammaturgia rovesciata, contrasto debole) | rampa completata al ~45%: `k' = clamp(k·2.2)` nel CameraDirector |
| alta | gradient | campo celeste piatto, tradiva la palette dark della direction | pesi del mix verso la dominante scura |

## Giro 2 → fix
| Gravità | Sezione | Problema | Fix |
|---|---|---|---|
| alta | gradient | ancora chiaro: mx_noise vive in un range stretto attorno a 0 → la MEDIA del mix decide tutto | media portata a 0.22 + `clamp(0,1)` (mix estrapola sotto 0) |
| media | kinetic (mobile) | forma ancora dominante nel framing portrait | ritirata camera aspect-aware: `kineticZ = 6.5 + (1−aspect)·4` sotto aspect 1 |

## Giro 3
Nessun nuovo rilievo. Campo notturno con vene di colore ✓ · testo protagonista nel kinetic ✓ ·
pin+caption ✓ · hero split con scrim ✓ · preloader esce pulito ✓.

## Issue del giro precedente (2026-07-09) — chiusi by-design nel blueprint 02
- ~~eyebrow senza `--mono`~~ → `.bp-eyebrow` usa `var(--mono)` (Fragment Mono self-host)
- ~~contrasto eyebrow sul bordo della sfera~~ → scrim locale `.bp-hero__copy::before`

Lezione per la skill (candidata): con mx_noise il parametro estetico vero è la MEDIA del fattore
di mix, non l'ampiezza — annotato nel materiale `gradientField.ts`.

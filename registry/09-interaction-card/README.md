# 09 · interaction-card

Schede con decodifica, magnetismo e ribaltamento. Il blueprint da usare quando i servizi o le
caratteristiche devono invitare al tocco invece di stare fermi.

## Come si usa

```tsx
import { InteractionCard } from '../registry/09-interaction-card/InteractionCard'
import cardCopy from '../content/09-card.json'

<InteractionCard copy={cardCopy} reduced={reduced} />
```

## Perché è accessibile e non solo vistoso

**La scheda è un `<button>`, non un div con `onClick`.** Ottiene gratis fuoco, invio e spazio, ruolo
e ordine di tabulazione. `aria-expanded` dice se è girata; la faccia nascosta è `aria-hidden`, o uno
screen reader leggerebbe entrambe le facce di fila.

**Il magnetismo vive su `gsap.quickTo` per asse, creato una volta.** Allocare una tween a ogni
`pointermove` è il modo classico di far scattare una griglia. Non si aggancia su puntatore
grossolano: inseguire un dito che non resta sullo schermo produce solo sobbalzi. Il `blur` riporta
la scheda al centro, o resterebbe spostata dall'ultimo passaggio del mouse mentre navighi col tab.

**Con `prefers-reduced-motion` spariscono scramble e magnetismo, ma NON il ribaltamento**: quello è
contenuto, non decorazione. Diventa istantaneo.

## Trappola nota

Lo scramble dura 1,1 s + `revealDelay`. La QA visiva deve aspettare almeno quello prima di scattare,
o fotografa il titolo a metà decodifica e nessun confronto sarà mai stabile — è il motivo per cui
`shoot.mjs` attende 1700 ms.

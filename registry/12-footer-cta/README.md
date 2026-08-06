# 12 · footer-cta

Il congedo: marquee continuo, CTA magnetico, velo che tiene il contrasto sopra la scena viva.

## Come si usa

```tsx
import { FooterCta } from '../registry/12-footer-cta/FooterCta'
import footerCopy from '../content/12-footer.json'

<FooterCta copy={footerCopy} reduced={reduced} />
```

## Le decisioni che contano

**Il marquee è una sola tween infinita su una lista duplicata**, con `modifiers` che riporta la x
dentro la metà (`gsap.utils.wrap`). Non accumula errore e non richiede di rimontare nulla a ogni
ciclo. La copia duplicata è `aria-hidden`, o uno screen reader legge la frase due volte.

**Il CTA è un `<a>` vero**: il magnetismo è decorazione sopra un link che funziona comunque — con la
tastiera, col tasto centrale, col menu contestuale. L'ascolto del puntatore sta sulla SEZIONE, non
sul bottone: un magnete che si attiva solo quando sei già sopra il bersaglio non è un magnete, è un
hover.

**Il velo è radiale e su uno pseudo-elemento che deborda dal blocco di testo.** Messo come
`background` del blocco, il box lo ritagliava prima che la sfumatura arrivasse a zero e il risultato
si leggeva come una toppa rettangolare — il difetto che il velo doveva evitare. Marquee e atmosfera
restano aperti sulla scena; solo il testo centrale ha un fondo.

## Perché serve un velo

La scena persistente resta accesa dietro tutto il sito. Su una sezione di solo testo centrato questo
è un problema di leggibilità, non di gusto: al primo giro di QA il corpo finiva sopra la parte
illuminata della forma. La regia arretra già la camera nel capitolo footer; il velo è la seconda
cintura, quella che non dipende da dove si trova la forma in quel preciso frame.

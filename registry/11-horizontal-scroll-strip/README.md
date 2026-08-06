# 11 · horizontal-scroll-strip

Striscia orizzontale pinnata: la ruota verticale muove la traccia di lato. Buono per processi,
timeline e cataloghi brevi.

## Come si usa

```tsx
import { HorizontalScrollStrip } from '../registry/11-horizontal-scroll-strip/HorizontalScrollStrip'
import stripCopy from '../content/11-strip.json'

<HorizontalScrollStrip copy={stripCopy} reduced={reduced} />
```

## Le tre decisioni che contano

**La corsa verticale è calcolata da `scrollWidth - clientWidth`**, non da un multiplo di `100vh`
scelto a occhio. Con un numero di pannelli diverso, o su un viewport più stretto, un multiplo fisso
lascia la striscia a metà oppure pinna una sezione ormai vuota. `invalidateOnRefresh` la ricalcola
a ogni resize.

**Crea il proprio trigger con `pin` e NON usa `useSectionProgress`** (come il blueprint 05): sarebbero
due trigger sullo stesso elemento con geometrie diverse, e il progresso scritto nella mappa non
corrisponderebbe a quello del pin. Scrive `progressMap.strip` dall'`onUpdate` del proprio trigger.

**`grid-template-columns: minmax(0, 1fr)` sulla sezione non è decorativo.** Un elemento di griglia
ha `min-width: auto`, quindi la colonna si allarga per contenere la traccia flex non-wrap; la
testata eredita quella larghezza e il titolo smette di andare a capo. A 390 px il titolo finiva
tagliato fuori dallo schermo. Azzerare il minimo lascia la colonna al viewport e fa debordare la
traccia — che è esattamente ciò che GSAP traduce.

## Reduced motion

Niente pin, niente traduzione: la traccia diventa un contenitore a scorrimento orizzontale nativo
con `scroll-snap`, `tabIndex={0}` così resta raggiungibile da tastiera.

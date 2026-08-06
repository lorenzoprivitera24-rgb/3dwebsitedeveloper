# 07 · editorial-gallery

Griglia magazine con rivelazione all'ingresso e parallasse. Serve quando il contenuto è un elenco
di pezzi che devono leggersi come una rivista, non come una lista.

## Come si usa

```tsx
import { EditorialGallery } from '../registry/07-editorial-gallery/EditorialGallery'
import galleryCopy from '../content/07-gallery.json'

<EditorialGallery copy={galleryCopy} reduced={reduced} />
```

Ogni `item` accetta `src` e `alt` opzionali: senza immagine la figura resta un campo di token, che è
il modo giusto di mostrare la struttura prima che gli asset esistano (stadio S4 non ancora chiuso).

## Le due decisioni che contano

**La parallasse è per COLONNA, non per cella.** Sfalsare ogni cella indipendentemente scioglie la
griglia: il lettore perde l'allineamento orizzontale, che è precisamente ciò che rende «magazine»
una griglia. Le colonne alterne salgono e scendono; le righe restano leggibili.

**Il numero di colonne si MISURA dal DOM**, contando quante celle condividono il primo `offsetTop`.
La griglia è `auto-fit`, quindi il conteggio lo decide il CSS: ripeterlo in JS con una media query
gemella funziona finché qualcuno non tocca il `minmax()`, e da lì in poi diverge in silenzio. Su
mobile la griglia collassa a una colonna e la parallasse si annulla da sé.

## Costo

Un trigger di rivelazione + un trigger di parallasse per cella. Su liste molto lunghe (>24 celle)
conviene passare a un solo trigger per colonna con `gsap.utils.toArray` raggruppato.

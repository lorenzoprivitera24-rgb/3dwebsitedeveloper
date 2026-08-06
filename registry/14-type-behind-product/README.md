# 14 · type-behind-product

Il display gigante attraversa **dietro** il prodotto scontornato. È il movimento che fa sembrare
caro un sito di prodotto, e non è un effetto: è un ordine di z-index.

```tsx
<TypeBehindProduct copy={veilCopy} product={cutouts.products.stack} reduced={reduced} />
```

## Perché funziona

Un titolo che scorre **sopra** la foto è un banner. Lo stesso titolo che sparisce dietro
l'oggetto e riappare dall'altra parte dice che l'oggetto **sta in uno spazio**, non su una pagina.
Tutto il resto — la corsa, la contro-parallasse, l'inclinazione — serve solo a far notare
l'occlusione.

Da cui la precondizione dura: **serve alpha vera**. Con una foto su fondo pieno non c'è niente da
occludere e la sezione diventa un banner. Se il cliente manda solo JPEG su fondo, il lavoro da
fare è lo scontorno, non il codice.

## Due movimenti, due proprietari

| elemento | chi lo muove | cosa |
|---|---|---|
| `.bp-veil__band` | timeline dello scrub | la corsa orizzontale legata allo scroll |
| `.bp-veil__track` | `gsap.quickTo` sulla velocità | l'inclinazione, che rilassa a zero da sola |
| `.bp-veil__product` | timeline dello scrub | contro-parallasse (~6% in senso opposto) + scala |

Sono **nodi diversi apposta**. Corsa e inclinazione sullo stesso elemento significano due tween
sul suo `transform`: l'ultima scritta cancella l'altra (regola non negoziabile n. 2). E
l'inclinazione si fa con `quickTo`, non con `gsap.to` dentro `onUpdate`: quello accoda una tween
per frame ed è il modo classico di far tremare il testo.

La contro-parallasse è **piccola**. È lo scarto fra parola e oggetto a dare profondità, non la
corsa in sé: se anche il prodotto viaggia, l'occhio legge una carrellata e l'occlusione sparisce.

## Il taglio richiede overflow

`.bp-veil { overflow: hidden }` non è cosmetica: il nastro esce dai fianchi e senza quel taglio la
pagina prende uno scroll orizzontale — che su mobile è un difetto grave e silenzioso.

## Tipografia e accessibilità

Il nastro usa `--display-condensed` (grottesco stretto e pesante: Anton nello scaffale
`lib/fonts/`). Assente, il token ricade sul display normale e la sezione perde metà del carattere.
Si dichiara in `brief/direction.md` → `"fonts": { "condensed": "Anton" }` → `npm run tokens:build`.

Le ripetizioni della parola sono `aria-hidden`: il titolo vero della sezione è l'`<h2>` nel blocco
in primo piano. Ripetere una parola tre volte in un lettore di schermo non comunica niente.

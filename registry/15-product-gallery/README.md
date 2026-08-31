# 15 · product-gallery

La griglia del listino: card con scontornato, nome in condensato, prezzo in mono.

```tsx
<ProductGallery copy={galleryCopy} product={cutouts.products.stack} reduced={reduced} />
```

## Due movimenti su due nodi, più l'hover che non litiga

| cosa | dove | come |
|---|---|---|
| reveal a cascata | `.bp-prodgallery__card` | `gsap.from` toggle, **entra** e non si scrubba |
| parallasse | `.bp-prodgallery__art` | `fromTo` scrubbata, sfalsata per colonna (`i % 2`) |
| hover | `.bp-prodgallery__art` | CSS **`scale:`**, non `transform` |

L'hover è il pezzo interessante. `scale:` e `translate:` sono proprietà CSS **indipendenti** da
`transform`: si compongono con quello che GSAP sta scrivendo invece di sovrascriverlo. È così che
si ottiene hover *e* parallasse sullo stesso nodo senza rompere la regola «un solo proprietario
per proprietà» — il proprietario di `transform` resta GSAP, l'hover vive altrove.

La parallasse è sfalsata per colonna apposta: con la stessa ampiezza su tutte le card la griglia
si muove come un blocco unico, e a quel punto tanto vale non muoverla.

`.bp-prodgallery__frame` ha `overflow: hidden` e l'art è più largo del necessario: è quel margine che
permette alla parallasse di correre senza scoprire i bordi del riquadro.

## `layerId`: vendere i pezzi separati

`items[].layerId` mostra **un solo strato** del prodotto invece della pila intera. Serve al caso
frequente in cui il listino vende i componenti che la vista esplosa (blueprint 13) ha appena
mostrato: stessi asset, nessuno scontorno in più da commissionare.

Il prezzo va in `meta`, in mono con `tabular-nums`: le cifre devono incolonnarsi fra le card, se no
la riga dei prezzi balla e la griglia sembra storta.

> Rinumerato da 07 nel merge di ago 2026: il 07 è la gallery editoriale (senza scontornati);
> questo è il listino prodotto con `layerId` sugli strati di encode-cutouts.

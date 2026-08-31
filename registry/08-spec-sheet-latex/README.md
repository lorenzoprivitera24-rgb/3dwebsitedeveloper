# 08 · spec-sheet-latex

La scheda tecnica: dati secchi in `<dl>`, formule KaTeX, note a piè di sezione con andata e ritorno.

```tsx
<SpecSheetLatex copy={specCopy} reduced={reduced} />
```

## Le tre decisioni

| cosa | scelta | perché |
|---|---|---|
| KaTeX | import dinamico in useEffect (js+css) | regola 9: l'entry non paga mai le formule; i font woff2 li emette Vite (self-host, GDPR) |
| fallback | sorgente LaTeX in `<code>` finché KaTeX non c'è | la scheda è leggibile SEMPRE; la formula bella è un upgrade, non un requisito |
| note | `<sup><a>` con id + ↩ di ritorno | la tastiera viaggia avanti e indietro senza perdere il punto |

Il reveal delle righe è un toggle (entra e basta): contenuto tecnico, deve arrivare leggibile,
non ballare con lo scrub.

## Nella demo

Siede DENTRO il blocco quiete del prodotto (fra prodgallery e gallery): eredita il segnale `e`
della regia — la scena resta a morph 0.08 senza una tratta dedicata. Spostarla fuori dal blocco
= darle una tratta in CameraDirector.

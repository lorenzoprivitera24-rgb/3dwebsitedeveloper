# content/ — il copy, una sezione = un file

`<NN>-<slug>.json` nell'ordine di scroll (es. `01-hero.json`). Gli slot sono ESATTAMENTE quelli
chiesti dallo storyboard — niente testo orfano, niente slot inventati. Schema tipo:

```json
{
  "section": "hero",
  "eyebrow": "WEBGPU / TSL / R3F V9",
  "headline": "Form in Motion",
  "sub": "Scroll, or move your cursor across the shape.",
  "cta": { "label": "Keep scrolling", "href": "#next" },
  "footnote": null
}
```

Regole (copy-chief): headline sotto le 6 parole; eyebrow tecnico in mono; footnote con asterisco
solo se il tono è satirico; mai gergo da AI né frasi fatte da agenzia. La lingua la decide il brief.

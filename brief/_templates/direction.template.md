# Direction — <progetto>

Data: <YYYY-MM-DD> · Input: `brief/brief.md` · Owner: creative-director
**Una direzione sola, opinionata. Niente menu di opzioni.**

## Riferimenti (3, descritti a parole — mai asset altrui)
1. <sito/opera>: <cosa prendiamo: es. "il ritmo delle sezioni pinnate, 250vh ciascuna">
2. …
3. …

## Tipografia
- **Display**: <famiglia> (<pesi>) — self-host da `lib/fonts/` (aggiungere con `scripts/add-font.mjs` se manca)
- **Testo**: <famiglia> (<pesi>) · **Mono (eyebrow)**: <famiglia>
- **Scala**: display `clamp(2.8rem, 1rem + 9vw, 11rem)`, leading 0.95, `text-wrap: balance`; eyebrow 0.75rem mono maiuscoletto tracking largo

## Vocabolario di motion
- **Durate**: micro <ms>, base <ms>, scene <vh per sezione pinnata>
- **Easing**: <es. power2.out per entrate, none per scrub>
- **Si muove**: <cosa> · **NON si muove mai**: <cosa>
- **Reduced-motion**: <stato statico equivalente per ogni effetto>

## Tono del copy
- 2 aggettivi: <…, …> · 1 divieto: <mai …>

## 5 «non fare» di questo progetto
1. … 2. … 3. … 4. … 5. …

## Tokens (compilati da `npm run tokens:build` → CSS vars + uniform TSL)
```json
{
  "tokens": {
    "colors": { "bg": "#0b0b10", "bg2": "#101018", "fg": "#eef1f7", "muted": "#9aa3b2", "accent": "#7c5cff" },
    "gradient": { "a": "#0b0b10", "b": "#7c5cff", "c": "#ff7ad9", "flow": 0.15 },
    "fonts": { "display": "Fraunces", "body": "Schibsted Grotesk", "mono": "Fragment Mono" },
    "motion": { "micro": 0.18, "base": 0.6, "sceneVh": 250, "ease": "power2.out" }
  }
}
```

## Checklist completezza
- [ ] Una sola direzione, motivata contro il brief
- [ ] Font verificati nello scaffale (o fetch pianificato) e licenze ok
- [ ] Blocco tokens valido (`npm run tokens:build` passa)
- [ ] Reduced-motion definito per ogni voce del vocabolario
- [ ] I 5 non-fare sono specifici, non generici

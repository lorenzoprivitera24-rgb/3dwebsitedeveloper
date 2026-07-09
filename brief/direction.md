# Direction — demo starter «Form in Motion»

Data: 2026-07-09 · Input: demo interna (nessun brief cliente) · Owner: creative-director
Nota: questa è la direction dell'attuale demo del kit — serve da esempio compilato E alimenta il
token bridge (`npm run tokens:build`). I valori coincidono con la palette storica della demo.

## Riferimenti (3, descritti a parole)
1. Genere ORYZO (dossier in docs/): una scena persistente che si trasforma, display serif gigante
   sopra il canvas, eyebrow tecnico in mono.
2. threejs.paris (recon lug26): materiale scuro riflettente su fondo quasi nero, luce da studio.
3. ylem.watch (recon lug26): disciplina — poche cose, ben temporizzate, niente decorazione.

## Tipografia
- **Display**: Fraunces (300/500/600) — self-host `lib/fonts/Fraunces`
- **Testo**: Schibsted Grotesk (400/500/700) — self-host `lib/fonts/SchibstedGrotesk`
- **Mono (eyebrow)**: Fragment Mono — self-host `lib/fonts/FragmentMono`
- **Scala**: display `clamp(2.8rem, 1rem + 9vw, 9rem)`, leading 0.95; eyebrow 0.78rem tracking 0.18em

## Vocabolario di motion
- **Durate**: micro 0.18s · base 0.6s · scena pinnata 250vh
- **Easing**: `power2.out` per entrate, `none` dentro lo scrub
- **Si muove**: la forma (displacement da scroll+pointer), la camera, le entrate del testo
- **NON si muove mai**: il layout (niente reflow animati), il footer
- **Reduced-motion**: forma allo stato B statico, entrate → opacity semplice, HUD invariato

## Tono del copy
- 2 aggettivi: preciso, calmo · 1 divieto: mai gergo da AI

## 5 «non fare»
1. Niente secondo canvas o background React Bits sotto la scena WebGPU
2. Niente colori fuori dal blocco tokens
3. Niente pin senza trasformazione di scena
4. Niente font via CDN (self-host, GDPR)
5. Niente post-processing custom finché il nativo non serve davvero

## Tokens
```json
{
  "tokens": {
    "colors": { "bg": "#07090d", "bg2": "#0b0e14", "fg": "#eef1f7", "muted": "#9aa3b2", "accent": "#5b8cff" },
    "gradient": { "a": "#07090d", "b": "#5b8cff", "c": "#8db4ff", "flow": 0.15 },
    "fonts": { "display": "Fraunces", "body": "Schibsted Grotesk", "mono": "Fragment Mono" },
    "motion": { "micro": 0.18, "base": 0.6, "sceneVh": 250, "ease": "power2.out" }
  }
}
```

## Checklist completezza
- [x] Una sola direzione, motivata (demo storica del kit)
- [x] Font verificati nello scaffale, licenze OFL
- [x] Blocco tokens valido (`npm run tokens:build` passa)
- [x] Reduced-motion definito per ogni voce
- [x] I 5 non-fare sono specifici del progetto

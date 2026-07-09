// GENERATED da scripts/build-tokens.mjs ← brief/direction.md — NON EDITARE A MANO
// Fonte unica per le uniform TSL e i componenti: stessa verità del CSS (tokens.css).
export const TOKENS = {
  "colors": {
    "bg": "#07090d",
    "bg2": "#0b0e14",
    "fg": "#eef1f7",
    "muted": "#9aa3b2",
    "accent": "#5b8cff"
  },
  "gradient": {
    "a": "#07090d",
    "b": "#5b8cff",
    "c": "#8db4ff",
    "flow": 0.15
  },
  "fonts": {
    "display": "Fraunces",
    "body": "Schibsted Grotesk",
    "mono": "Fragment Mono"
  },
  "motion": {
    "micro": 0.18,
    "base": 0.6,
    "sceneVh": 250,
    "ease": "power2.out"
  }
} as const

export type Tokens = typeof TOKENS

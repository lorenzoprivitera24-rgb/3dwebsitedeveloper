# Starter Next — il gemello che indicizza

Il P1 della gap analysis (righe 7 · 8 · 15), chiuso: l'App Router gemello della SPA Vite.
**La SPA resta il laboratorio; questo è lo starter dei siti CLIENTE che vivono di ricerca.**

## La dottrina, in quattro regole

1. **L'LCP è testo server-rendered, mai il canvas.** La home è un server component: titolo, copy
   e link esistono nell'HTML della prima risposta. Il canvas si monta dopo, dietro, `aria-hidden`.
2. **Il confine è `CanvasShell`** — `dynamic(() => import('./CanvasScene'), { ssr: false })` in un
   client component. È la regola 9 del kit in dialetto Next: three non esiste nel server bundle
   né nel percorso critico. Il fallback è `null` DI PROPOSITO: il poster vero è l'HTML sotto.
3. **Le pagine di contenuto sono solo server components** (`/manifesto`): zero chunk di scena,
   zero idratazione inutile. Il sipario fra route è una **View Transition di solo CSS**
   (`::view-transition-*` in `globals.css` + flag `experimental.viewTransition`) — il cambio
   pagina non ha bisogno di WebGL, e con `prefers-reduced-motion` si spegne.
4. **Un solo ponte token.** `npm run tokens:pull` copia il blocco `:root` generato dal kit
   (`brief/direction.md` → `build-tokens.mjs` → `tokens.css`). Si edita la direction, mai i
   valori qui. Font: self-host da `lib/fonts` del kit via `next/font/local` — mai il CDN Google.

## Cosa sostituire in un progetto vero

- `CanvasScene.tsx` in blocco (è la grammatica del kit ridotta all'osso: init asincrono WebGPU
  con fallback WebGL2, AgX, materiale TSL, damp). Il contratto da conservare è il CONFINE.
- Il copy delle pagine (S3 della pipeline) e i token (S1).
- I font di sistema in `globals.css` con `next/font/local` puntato ai woff2 del kit.

## Comandi

```bash
npm install
npm run dev          # localhost:3000
npm run build        # la prova: se three finisce nel server bundle, QUI si rompe
npm run tokens:pull  # riallinea i token dal kit
```

# 13 · product-explode

La sezione che regge da sola i siti «prodotto editoriale» (food, beverage, packaging, hardware):
la pila di scontornati si apre allo scrub, ogni strato porta la sua etichetta, poi si richiude.

```tsx
<ProductExplode copy={explodeCopy} product={cutouts.products.stack} reduced={reduced} />
```

## Il contratto degli asset

Gli strati arrivano da `scripts/encode-cutouts.mjs`, non da una cartella qualsiasi:

```
public/assets/raw/cutouts/<prodotto>/NN-<nome>.png   →  npm run cutouts:encode
```

`NN` crescente = **dal basso verso l'alto** della pila fisica. Tutti gli strati devono stare
sulla **stessa tela**: l'encoder calcola il bounding box dell'unione e ritaglia quello stesso
rettangolo da ognuno. È questo che tiene la pila allineata — ritagliare strato per strato allinea
ogni PNG al proprio inchiostro e a video la pila si sfalsa. Se l'encoder dice *«gli strati devono
condividere la stessa tela»*, il problema è a monte, nello scontorno.

Fixture per lavorare senza le foto vere del cliente: `npm run cutouts:fixture`.

## Le tre regole del movimento

1. **Un solo transform per strato.** Immagine, ombra e annotazione stanno *dentro* lo stesso
   `.bp-explode__layer`: si muove il contenitore. Animare l'etichetta con una sua tween la fa
   sfasare di qualche frame sullo scrub veloce — il difetto che fa sembrare la sezione un
   collage.
2. **L'ombra ha il segno dello spostamento.** Chi sale ha l'ombra più larga e più tenue, chi
   scende più stretta e più densa (`scale 1 ± 0.11k`, opacità inversa). Senza, gli strati
   sembrano adesivi che scivolano.
3. **La pila si richiude prima di uscire** (`reassemble`, default acceso). La sezione successiva
   riceve il prodotto intero. Un'esplosione a metà che si sfila dallo schermo legge come un bug.

## Proprietà e accessibilità

Il transform di `.bp-explode__shadow` e di `.bp-explode__note` appartiene **solo a GSAP**: nel CSS
si posizionano con `left/top/margin`. Due proprietari sullo stesso transform = sfarfallio (regola
non negoziabile n. 2 del kit).

Il testo accessibile è la `<ol class="bp-explode__legend">`, non le annotazioni: quelle sono
`aria-hidden`, copie decorative agganciate agli strati. La legenda è sr-only su desktop e
**visibile** su mobile e in `prefers-reduced-motion`, dove il pin non esiste e la pila resta
assemblata.

Scrive `progressMap.explode`: nel capitolo il protagonista è il DOM, quindi il CameraDirector
deve calmare la scena 3D dietro (morph giù, camera indietro) — vedi `src/canvas/CameraDirector.tsx`.

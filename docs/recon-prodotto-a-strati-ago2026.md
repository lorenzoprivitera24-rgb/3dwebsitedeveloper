# Ricognizione — il genere «prodotto a strati» (6 ago 2026)

## Il riferimento

Reel di un'agenzia (`w.wearebrand`, 10s, verticale) che mostra lo scroll di un sito per un brand
di hamburger, ripreso da schermo. Claim in sovrimpressione: *«AI can't do that. We do.»*

**Il dato che cambia tutto sta nell'angolo in basso a destra: «Made with Framer».** Il sito è DOM.
Nessun canvas, nessun renderer. E la sequenza di sezioni è questa:

1. hero — scontornato del prodotto a tutto campo, display condensato in maiuscolo, fondo quasi nero
2. `THE STACK` — vista **esplosa**: il panino si separa in strati, ognuno con etichetta e leader
   line sulla destra; poi si richiude
3. `SMASHED TO ORDER` — la pila cade in verticale, il display scorre dietro
4. `OVERTIME SHAKES` / `GAME DAY COMBO` — display gigante che attraversa **dietro** i prodotti
5. `THE LINEUP` — griglia di card prodotto con prezzi
6. chiusura su packaging su fondo nero

Livrea: near-black + un solo accento caldo (arancio/rosso), grottesco stretto pesante in
maiuscolo, fotografia lucida con ombre di contatto, badge a bollo.

## Cosa ha insegnato

**Il genere non è 3D, e chiamarlo 3D costa settimane.** L'effetto si regge su fotografia
scontornata + un vocabolario piccolissimo di coreografie 2D scrubbate. Il kit era sbilanciato
sull'asse WebGPU/TSL e non copriva **niente** di questo: nessuna pipeline per l'alpha, nessun
blueprint a strati, nessun modo di verificare una sezione pinnata a metà corsa.

Tre buchi, tutti chiusi in questo giro:

| buco | chiuso con |
|---|---|
| `encode-assets` parla solo GLB/KTX2: nessuna pipeline per gli scontornati | `scripts/encode-cutouts.mjs` + `gen-cutout-fixture.mjs` |
| il registro non aveva né vista esplosa né occlusione né griglia listino | blueprint **13**, **14**, **07** |
| `qa:shoot` scatta all'inizio di ogni sezione ⇒ per una pinnata fotografa sempre lo stato A | `scripts/shoot-scrub.mjs` (`npm run qa:scrub`) |

Più due primitive nate strada facendo:

- **`useApproach`** (`src/scroll/useSectionProgress.ts`) — il canale di avvicinamento, 0→1 mentre
  la sezione entra e chiude a 1 quando il pin comincia. Serve perché `progressMap` vale 0 al primo
  frame del pin, quando la sezione riempie già lo schermo: una scena che si calma lì si calma
  sotto gli occhi di chi guarda.
- **token `--display-condensed`** — il grottesco stretto è metà del carattere del genere e il
  blocco tokens non aveva dove metterlo.

## Le lezioni che non si vedono nel codice

- **La registrazione condivisa fra strati** è la regola che regge tutto. Ritagliare ogni PNG sul
  proprio inchiostro pesa meno e disallinea la pila: difetto irrecuperabile lato CSS.
- **Un'ombra non è la sagoma schiacciata.** Schiacciare la silhouette di un oggetto alto produce un
  rettangolo — i fianchi verticali riempiono ogni colonna. Serve una maschera radiale. Si vede solo
  a video: il codice sembra giusto.
- **L'occlusione è un ordine di z-index**, non un effetto. È l'unica cosa che dice «l'oggetto sta
  in uno spazio». Da cui la precondizione da mettere in preventivo: **serve alpha vera**. Se il
  cliente manda JPEG su fondo, il lavoro è lo scontorno.
- **Arretrare la camera non basta su portrait.** La forma «calma» resta grande dietro la pila e le
  annotazioni ci finiscono sopra: serve lo scrim locale sulla sezione, sfumato ai bordi.

## Dove vive il sapere

Grammatica completa nella skill **`layered-product-choreography`**. La grammatica motion generale
resta in `awwwards-motion-patterns`; il legame scroll→scena 3D in `scroll-scene-choreography`.

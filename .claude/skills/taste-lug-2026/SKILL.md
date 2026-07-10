---
name: taste-lug-2026
description: >
  Il gusto codificato del kit, fotografato a LUGLIO 2026: i pattern estetici dominanti nei siti
  premiati, i segnali che distinguono un sito "non banale" da uno generico-2024, gli anti-pattern
  vietati e i default di direzione. Il creative-director la consulta in S1 PRIMA di scrivere
  direction.md; il visual-qa-operator la usa in S6 come metro del "sa di premium". Da
  rinfrescare ogni trimestre con la ricognizione (scripts/recon-fingerprint.mjs + recon visivo).
  Trigger: "che stile va adesso", "trend 2026", "non deve sembrare un template", "deve sembrare
  del 2026", "gusto", "estetica attuale".
---

# Il gusto a luglio 2026 — regole, non vibe

> Fotografia: 10 lug 2026 (ricerca Awwwards/FWA/Codrops + articoli datati 2026). Refresh
> trimestrale: rifai la ricognizione, aggiorna QUESTA skill, data in testa. Un kit col gusto
> vecchio produce siti vecchi in silenzio.

## I pattern dominanti (usali con intenzione, non tutti insieme)

1. **Kinetic typography** — il testo È un elemento di design: cambia peso, si allunga sullo
   scroll, reagisce all'hover, entra char-by-char con ordine leggermente irregolare (mai il
   fade-in uniforme). SplitText 2025 (gratis, a11y nativa) è lo strumento.
2. **3D con uno scopo** — il 3D immersivo è mainstream (e-commerce/SaaS inclusi): quello che
   premia è il 3D legato al contenuto (prodotto, mondo del brand, metafora del servizio), non
   lo showpiece galleggiante.
3. **Cursore come strumento** — il pointer non decora: disturba materiali (influence map alla
   Podium), rivela profondità, scava. Su mobile l'equivalente touch è pianificato, non omesso.
4. **Scrollytelling maturo** — lo scroll racconta: scena persistente che si trasforma tra
   sezioni, progressione narrativa, pin usati con parsimonia (vedi awwwards-motion-patterns).
5. **Dopamine palette / bold color** — saturazioni alte, neon gradient, contrasti forti (filone
   lifestyle/youth) ACCANTO al filone cinematografico scuro con grading deliberato (AgX). La
   scelta è di carattere, non di moda: brand caldo→dopamine, brand tecnico/lusso→cinema.
6. **Broken grid + personalità** — layout editoriali che rompono la griglia con intenzione
   (sovrapposizioni, margini asimmetrici), display type gigante, eyebrow mono.
7. **Profondità come standard** — piani multipli, fog, parallax volumetrico: la pagina 2026 non
   è piatta nemmeno quando non è "un sito 3D".
8. **Audio spazializzato (opt-in)** — nel genere alto (Bruno Simon SOTM gen 2026) il suono
   ambientale firma l'esperienza; sempre con toggle e mai autoplay invadente.

## Segnali "non banale" (checklist S1/S6)

- C'è UN momento-firma che non hai già visto identico altrove (il "cosa ricordi domani?").
- La palette prende posizione (né grigio-safe né arcobaleno default); il grading è deliberato.
- Il motion ha una grammatica coerente (stesse curve/durate dai token) e serve la narrativa.
- La tipografia display fa metà del lavoro estetico; la body resta leggibilissima.
- Il sito è riconoscibile in uno screenshot 390px (se il carattere vive solo a 1440, è debole).

## Anti-pattern VIETATI (bocciano il QA estetico)

- Hero statico "titolo + sottotitolo + bottone + immagine" senza un'idea di motion o profondità.
- 3D showpiece scollegato dal contenuto (l'oggetto che ruota perché sì).
- Fade-in uniforme di tutto allo scroll (il "template AOS 2019") e parallax decorativo ovunque.
- Palette desaturata-corporate di default; gradient viola-blu da template AI.
- Cursori custom che nascondono il puntatore senza dare nulla in cambio; suoni non richiesti.
- Motion identico su ogni sezione (la grammatica ha bisogno di accenti, non di monotonia).
- Glassmorphism/neumorphism di default senza motivo di brand (leggibili come 2021-2023).

## Default di direzione (quando il brief non vincola)

- Tonemapping AgX; grana leggera + vignetta dal cookbook; 3:4 dei blocchi media meglio di 1:1.
- Type: 1 display con personalità + 1 sans leggibile + 1 mono per eyebrow/dati (scaffale
  lib/fonts). Scala fluida clamp().
- Motion: ease custom dai token (mai i default lib), 200-400ms micro / 0.8-1.2s scene, damp
  ovunque (kit rule).
- Un colore d'accento coraggioso ancorato al brand; neutri caldi o freddi MA scelti.

## Processo di refresh (trimestrale o a ogni progetto-vetrina)

1. `node scripts/recon-fingerprint.mjs` sui 4-6 siti premiati più recenti + shoot visivo.
2. Confronta coi pattern qui sopra: cosa è salito, cosa è sceso, cosa è diventato cliché.
3. Aggiorna le sezioni + la data in testa. Un pattern che appare su 3+ template mainstream
   passa automaticamente tra gli anti-pattern (è finito il suo ciclo premium).

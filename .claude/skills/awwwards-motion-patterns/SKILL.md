---
name: awwwards-motion-patterns
description: >
  La grammatica motion del genere Awwwards/FWA (lug 2026): quando pinnare e quando no, scrub vs
  toggle, durate in vh, SplitText 2025, FOUC, cleanup, CLS da pin-spacer. Usare quando si
  coreografa una pagina scroll-driven, si scrive o implementa uno storyboard, o il QA segnala
  motion "che non sa di premium". Trigger: "anima la pagina", "sezione pinnata", "scrub",
  "coreografia scroll", "il motion sembra povero".
---

# Awwwards motion patterns — la grammatica del genere

Il loop unico Lenis+GSAP è già cablato in `src/scroll/SmoothScroll.tsx` (non toccarlo: un solo
RAF, `autoRaf:false`, niente scrollerProxy in root-mode). Qui c'è la grammatica con cui si usa.

## Scrub vs toggle — la prima decisione

- **Scrub** (`scrub: true`): la timeline è cucita al pixel di scroll. Per trasformazioni della
  scena, morph, camera, progress bar narrative. È il default del genere.
- **Toggle** (`toggleActions`): entrate one-shot (fade/slide di testo e card). Per contenuto
  editoriale. MAI scrubbare un'entrata di testo: sa di slider anni '10.
- Regola: la SCENA si scrubba, il TESTO entra. Le eccezioni si motivano nello storyboard.

## Pin: quando sì, quando no

- Pinna quando la sezione È una scena che si trasforma (durata dichiarata in vh:
  `end: '+=250%'` = 2.5 viewport di permanenza). Non pinnare per gusto: ogni pin costa
  orientamento all'utente.
- Il pin genera un **pin-spacer**: riserva le altezze (niente layout shift = niente CLS).
  Con Lenis root-mode il pin funziona nativamente; `pinType` va toccato solo in wrapper-mode.
- `invalidateOnRefresh: true` sempre; `anticipatePin: 1` se il pin "scatta" visivamente.

## Durate e ritmo

- Micro-interazioni 150-250ms · entrate 500-800ms (`power2.out`/`power3.out`) · scene pinnate
  200-350vh. Easing `none` SOLO dentro lo scrub (l'easing lo fa il dito/rotella).
- Stagger tipografici 0.02-0.05s per char, 0.06-0.12s per parola/riga.
- Le durate del progetto vivono nei token (`motion` in direction.md) — non hardcodare.

## SplitText 2025 (GSAP 3.13+, tutto gratuito)

- `mask: 'lines'` integrato: niente wrapper overflow-hidden a mano.
- `autoSplit: true` ri-splitta a resize/font-load: ricostruisci l'animazione dentro `onSplit`
  (ritorna il timeline da lì), MAI fuori.
- Accessibilità gestita (aria sul contenitore) — non aggiungere aria-label doppi.
- FOUC: `visibility: hidden` via CSS sull'elemento, `autoAlpha` al primo tick, e splitta DOPO
  `document.fonts.ready`.

## Refresh, cleanup, navigazione

- `ScrollTrigger.refresh()` dopo `document.fonts.ready` E dopo il load delle immagini above-fold
  (start/end calcolati su layout sbagliati = trigger fuori posto).
- In React: OGNI animazione dentro `useGSAP(() => {...}, { scope })` — il revert al dismount è
  il 90% dei bug di navigazione risolti gratis.
- Componenti copiati (React Bits & co.): cleanup che uccide SOLO i propri tween
  (`tween.scrollTrigger?.kill()`), mai `ScrollTrigger.getAll().kill()` — vedi la regola in
  `references/interactive-components.md` della skill d'integrazione.
- `gsap.matchMedia()` per varianti responsive E per `(prefers-reduced-motion: reduce)`: lì lo
  scrub si sostituisce con stati statici equivalenti (decisi nello storyboard, non improvvisati).

## Anti-pattern che il QA deve segnalare

Entrate scrubbate · pin senza scopo narrativo · due owner sulla stessa proprietà · animazioni
fuori `useGSAP` · `normalizeScroll()` insieme a Lenis (si pestano) · durate hardcoded fuori dai
token · reduced-motion che spegne il contenuto invece del movimento.

---
name: layered-product-choreography
description: "Il genere «prodotto editoriale» (food, beverage, packaging, hardware): siti che si reggono su fotografia SCONTORNATA impilata e coreografata allo scroll — vista esplosa, display che passa dietro l'oggetto, griglia listino. Contratto degli asset, regole del movimento, difetti tipici. Usare quando il riferimento del cliente è un sito di prodotto con foto ritagliate (tipicamente Framer), quando arrivano strati in alpha, o quando si compongono i blueprint 13/14/07. Trigger: 'vista esplosa', 'strati del prodotto', 'testo dietro il prodotto', 'scontornato', 'sito tipo Framer', 'come è fatto il prodotto', 'listino con prezzi'."
---

# Coreografia del prodotto a strati

## Prima cosa: riconoscere il genere, e dire cosa lo regge

Quando un cliente porta come riferimento un sito di prodotto — hamburger, bottiglie, scarpe,
componenti — la reazione istintiva è «serve il 3D». Quasi sempre è sbagliata, e sbagliarla costa
settimane. **Questi siti sono DOM.** Il più delle volte sono fatti in Framer, e il loro effetto
non nasce da un renderer: nasce da tre cose, in quest'ordine di importanza.

1. **La fotografia scontornata.** Alpha vera, luce coerente fra gli strati, ombre che tornano.
   È il 70% del risultato ed è l'unica parte che non si scrive in codice.
2. **Un vocabolario piccolo di movimenti**, ripetuto con disciplina: la pila che si apre, il
   nome che passa dietro l'oggetto, la griglia che si rivela.
3. **Una direzione artistica secca**: fondo quasi nero, un solo accento caldo, grottesco stretto
   in maiuscolo, prezzi in mono.

Il corollario da dire al cliente **prima** di preventivare: se manda JPEG su fondo pieno, il
lavoro da fare è lo scontorno, non l'animazione. Senza alpha metà di questo vocabolario non
esiste — non «viene peggio»: **non esiste**.

Quando invece serve davvero il 3D: se l'oggetto va ruotato liberamente, configurato (colori,
varianti) o visto da angoli che nessuno ha fotografato. Se la coreografia è sempre la stessa
inquadratura, gli scontornati vincono su qualunque metrica — peso, tempo, fedeltà, batteria.

## Il contratto degli asset (dove si rompe tutto)

Gli strati passano da `scripts/encode-cutouts.mjs`:

```
public/assets/raw/cutouts/<prodotto>/NN-<nome>.png   →  npm run cutouts:encode
```

- `NN` crescente = **dal basso verso l'alto** della pila fisica.
- Tutti gli strati sulla **stessa tela**, stesse dimensioni. L'encoder calcola il bounding box
  dell'**unione** e ritaglia quel rettangolo da ognuno.

**La registrazione condivisa è la regola numero uno.** Ritagliare ogni PNG sul proprio inchiostro
sembra ovvio (pesa meno!) e disallinea la pila a video: ogni strato si centra su sé stesso invece
che sull'oggetto. Il difetto si vede subito ed è irrecuperabile lato CSS — si può solo ri-encodare.
Prezzo della regola: ogni strato è un rettangolo quasi tutto trasparente. In AVIF le zone
trasparenti costano quasi zero, e in cambio i blueprint impilano `position:absolute; inset:0`
senza un solo offset scritto a mano.

L'encoder produce anche l'**ombra di contatto** per strato. Non è un abbellimento: senza,
gli strati sembrano adesivi che scivolano. Ed è cotta con una maschera radiale apposta —
schiacciare la sagoma di un oggetto alto dà un **rettangolo**, non un'ombra (i fianchi verticali
riempiono ogni colonna). È il difetto classico che si vede solo a video.

Per lavorare prima che arrivino le foto vere: `npm run cutouts:fixture` disegna un oggetto
astratto a 5 strati con lo stesso contratto. La coreografia si giudica su quello.

## I tre blueprint, e cosa fa ciascuno

| # | id | il movimento | la precondizione |
|---|---|---|---|
| 13 | `product-explode` | la pila si apre allo scrub, ogni strato porta la sua etichetta, poi si richiude | ≥3 strati registrati |
| 14 | `type-behind-product` | il display gigante attraversa **dietro** l'oggetto | alpha vera + `--display-condensed` |
| 07 | `editorial-gallery` | griglia listino: reveal a cascata + parallasse per card | anche un solo strato per card (`layerId`) |

Sequenza che funziona quasi sempre: **mostra l'oggetto → aprilo (13) → nominalo (14) → vendilo
(07)**. La vista esplosa deve venire *prima* del listino: apre la curiosità che il prezzo poi
chiude.

## Le regole del movimento

**Un solo transform per gruppo.** Immagine, ombra e annotazione stanno dentro lo stesso nodo: si
muove il contenitore. Animare l'etichetta con una sua tween la fa sfasare di qualche frame sullo
scrub veloce — è il difetto che fa leggere la sezione come un collage invece che come un oggetto.

**L'ombra ha il segno dello spostamento.** Chi sale ha l'ombra più larga e più tenue, chi scende
più stretta e più densa. È l'unico segnale che dice «si sono staccati» invece di «si sono mossi».

**La pila si richiude prima di uscire.** Un'esplosione a metà che si sfila dallo schermo legge
come un bug. La sezione successiva deve ricevere il prodotto intero.

**L'occlusione è un ordine di z-index, non un effetto.** Un titolo sopra la foto è un banner; lo
stesso titolo che sparisce dietro l'oggetto dice che l'oggetto sta in uno spazio. Tutto il resto
(corsa, parallasse, inclinazione) serve solo a far *notare* l'occlusione.

**La contro-parallasse è piccola.** È lo scarto fra testo e oggetto a dare profondità: se anche
l'oggetto viaggia, l'occhio legge una carrellata e l'occlusione sparisce.

**Corsa e inclinazione su nodi diversi.** Due tween sul `transform` dello stesso elemento: l'ultima
cancella l'altra. E l'inclinazione da velocità si fa con `gsap.quickTo`, mai con `gsap.to` dentro
`onUpdate` — quello accoda una tween per frame ed è il modo classico di far tremare il testo.

**Hover senza litigare col transform.** `scale:` e `translate:` sono proprietà CSS indipendenti da
`transform`: si compongono con quello che GSAP sta scrivendo. È così che si ha hover *e* parallasse
sullo stesso nodo senza rompere «un solo proprietario per proprietà».

## Il capitolo del prodotto è una stanza buia

Se dietro c'è una scena 3D persistente, nei capitoli del prodotto deve **farsi da parte**, e la
calma va presa dall'**avvicinamento** (`useApproach`), non dal progress del pin: quando il pin
comincia la sezione riempie già lo schermo, e calmarsi lì significa calmarsi sotto gli occhi di
chi guarda. Un solo segnale per tutti i capitoli del prodotto di fila, se no fra una sezione e
l'altra la scena risale per un istante — e un lampeggio si nota molto più di una scena ferma.

Arretrare la camera **non basta su portrait**: la forma calma resta grande e le annotazioni
piccole ci finiscono sopra. Serve anche lo scrim locale sulla sezione (sfumato ai bordi, se no
ingresso e uscita diventano due stacchi netti).

## Accessibilità: le etichette non sono il contenuto

Le annotazioni agganciate agli strati e le ripetizioni della parola gigante sono **decorative**
(`aria-hidden`). Il contenuto vero è la legenda `<ol>` (blueprint 13) e l'`<h2>` in primo piano
(blueprint 14). Ripetere una parola tre volte in un lettore di schermo non comunica niente, e una
lista di etichette che si muovono non si legge.

La legenda è sr-only su desktop e **visibile** su mobile e in `prefers-reduced-motion`, dove il
pin non esiste: lì la pila resta assemblata e la legenda diventa la sezione.

## Come si verifica

`npm run qa:shoot` scatta a ogni sezione, cioè sempre lo **stato A**: per una sezione pinnata
certifica come buona un'animazione che nessuno ha visto muoversi. Per le coreografie scrubbate:

```bash
npm run qa:scrub -- explode 6 1440 900
```

Distribuisce N scatti lungo la corsa del pin (misurata sul `.pin-spacer`, non sulla sezione) e
riporta gli errori di console. **Si guardano i fotogrammi**, non l'exit code.

## Rimandi

- La grammatica motion generale — quando pinnare, scrub vs toggle, durate in vh, CLS da
  pin-spacer, SplitText — sta in **`awwwards-motion-patterns`**. Questa skill non la ripete:
  si occupa solo del vocabolario a strati.
- Il legame scroll → scena 3D persistente sta in **`scroll-scene-choreography`**.
- Il contratto dei blueprint e la regola d'oro del registro stanno in `CLAUDE.md` § La fabbrica.

---
name: client-intake
description: >
  Il questionario S0 e come compilarne brief/brief.md, nelle TRE porte d'ingresso della fabbrica:
  S0a solo prompt/questionario (obiettivo, 3+1 riferimenti, asset, vincoli), S0b immagine di
  riferimento + prompt (estrazione di direzione da screenshot/moodboard), S0c sito esistente da
  rifare + prompt (autopsia con scripts/site-autopsy.mjs). Cosa NON chiedere, e il gate di
  completezza che apre la pipeline. Usare a ogni nuovo progetto sito / nuova richiesta cliente,
  PRIMA di qualunque proposta creativa o tecnica. Trigger: "nuovo cliente", "nuovo sito",
  "brief", "rifai questo sito", "parti da questa immagine", "preventivo sito".
---

# Client intake (S0) — le domande che salvano la pipeline

Output: `brief/brief.md` dal template `brief/_templates/brief.template.md`. Il gate S0 è umano:
il brief lo conferma il cliente (o Lorenzo per lui). Finché il brief non è completo, S1 non parte
— un brief vago costa 3 giri di QA dopo.

## Le tre porte d'ingresso

L'input di un progetto arriva in una di tre forme. Tutte convergono su `brief/brief.md` e sul
gate umano; cambiano solo gli artefatti di supporto che S1 riceve come vincoli.

### S0a — Solo prompt (o call classica)

Il flusso base qui sotto. Se non c'è un cliente in call e il progetto nasce da un prompt di
Lorenzo, compila comunque TUTTO il brief: dove il prompt non risponde, scegli un default sensato
e marcalo **`[DEFAULT]`** nel brief — il gate umano deve vedere cosa ha deciso la macchina, non
scoprirlo in S6.

### S0b — Immagine/screenshot + prompt

L'immagine è un riferimento di direzione, NON il sito da copiare. Analizzala (visione diretta) e
compila `brief/reference-analysis.md` dal template `brief/_templates/reference-analysis.template.md`:
palette percepita con ruoli, coppia tipografica implicita, griglia/layout, mood e motion implicito
(cosa si muoverebbe), materiali/profondità 3D suggeriti, e — fondamentale — **cosa NON prendere**
dal riferimento. Poi il brief si compila come in S0a; `reference-analysis.md` va a S1 come
vincolo dichiarato. Diritti: il riferimento ispira token e regia, mai asset copiati (regola del
creative-director).

### S0c — Sito esistente da rifare + prompt

Esegui **`node scripts/site-autopsy.mjs <url>`** → `brief/legacy-audit.md` +
`brief/legacy-tokens.json`: contenuti e informazione architettura riusabili, token estratti dai
computed styles reali, asset brand (logo!), stack rilevato, verdetto Tieni/Butta/Reinventa
(proposta per il gate umano). Se c'è un logo → subito anche
**`node scripts/extract-brand.mjs <logo>`** → `brief/brand-kit.json` (per S1 e per l'agente
brand-alchemist). Nel brief, la sezione asset si compila dall'autopsia; al cliente si chiede solo
cosa CONFERMA di voler tenere (contenuti, tono) e cosa lo ha spinto a rifare il sito (il "perché
adesso" è la direzione).

## Come si conduce (call o form, 20 minuti)

1. **Obiettivo prima dell'estetica**: «se il sito funziona, cosa succede di concreto?» Una sola
   azione primaria. Se il cliente ne elenca tre, si sceglie in call, non dopo.
2. **I 3+1 riferimenti** (la domanda che fa il progetto): 3 siti che gli piacciono E COSA di
   ciascuno (ritmo? colori? il 3D? il tono?) + 1 che NON gli piace e perché. Il "perché" vale più
   del link — insistere finché non è specifico. Annotare le parole esatte del cliente.
3. **Inventario asset**: logo (vettoriale?), foto (qualità?), modelli 3D o prodotto fisico da
   modellare/generare, brand book, copy esistente. Per il 3D: prodotto reale (serve licenza/CAD),
   fittizio (corsia generativa a pagamento), o astratto (registro nostro).
4. **Vincoli veri**: lingue, deadline, budget, CMS imposto, analytics/GDPR, dispositivi del suo
   pubblico (se è mobile-first B2C, il tier low è il primo cittadino).

## Cosa NON chiedere al cliente

Palette e font («che colori vuole?» produce siti brutti — è compito del creative-director in S1);
scelte tecniche (renderer, librerie); wireframe. Il cliente porta obiettivo, gusto per
riferimenti e materiale — il resto è nostro.

## Segnali d'allarme da scrivere nel brief

«Come Apple ma con più cose» (conflitto densità/pulizia: farlo scegliere) · riferimenti tutti
diversi tra loro (gusto non formato: proporre NOI la direzione, gate S1 più importante) ·
«il 3D deve stupire» senza asset né budget asset (pianificare la corsia generativa o ridurre a
tier motion-craft — vedi `docs/gap-analysis-2026-07-09.md`, tier ylem) · deadline < 2 settimane
col registro attuale (scope: one-pager dai blueprint esistenti, zero CUSTOM).

## Gate di completezza

La checklist del template spuntata TUTTA + il cliente ha confermato per iscritto obiettivo e
deadline. Poi: aggiorna `PIPELINE_STATUS.md` (S0 ✓) e ingaggia `@agent-creative-director`.

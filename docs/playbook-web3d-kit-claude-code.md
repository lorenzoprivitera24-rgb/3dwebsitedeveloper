# Playbook: portare il Web3D Kit al livello "sito a richiesta"

Data: 8 luglio 2026
Uso previsto: questo file va messo nella root del repo del kit (o in `docs/`) e dato in pasto a Claude Code. La sezione 11 contiene il prompt di bootstrap che gli fa costruire tutto da solo, a fasi. Le decisioni di design derivano dal dossier gemello (`dossier-reverse-engineering-web3d.md`).

Principio guida, preso dai leader analizzati: l'agente non deve inventare, deve comporre dentro vincoli. Stack pinnato, libreria di blueprint, pipeline a stadi con artefatti, loop di verifica visiva. Il modello linguistico ci mette la regia, il sistema ci mette il pavimento di qualità.

---

## 1. Gap analysis del kit attuale

| Ruolo | Oggi | Manca |
|---|---|---|
| r3f-scene-architect | Sa costruire scene | Non ha blueprint da cui partire: reinventa layout di scena a ogni progetto |
| tsl-shader-engineer | Sa scrivere shader | Nessun cookbook di gradienti/effetti riusabili con parametri |
| scroll-motion-engineer | Sa fare timeline | Non riceve uno storyboard formale: coreografa a intuito |
| ui-overlay-a11y-engineer | Sa fare overlay | Nessun sistema tipografico/token condiviso tra progetti |
| interaction-engineer | Sa fare interazioni | Stesso problema: nessun catalogo (magnetic, scramble, rig puntatore) |
| perf-fallback-auditor | Verifica a fine corsa | Arriva tardi: i budget non sono gate automatici durante la build |
| React Bits | Componenti animati DOM | Copre il DOM, non il territorio 3D scroll-driven |

Ruoli del tutto assenti, che i leader invece hanno: direzione creativa (il "gusto" reso esplicito), storyboard narrativo dello scroll, copywriting premium, pipeline asset 3D, bibliotecario dei blueprint, operatore QA visiva, ricognizione competitiva. Manca inoltre l'orchestrazione: chi decide l'ordine, i gate, gli artefatti.

Nota di metodo: non frammentare oltre il necessario. La conoscenza condivisa (stack, convenzioni, gusto) vive in `CLAUDE.md` e nelle skill; i subagenti servono dove l'isolamento del contesto paga davvero (lavori rumorosi: QA, asset, ricognizione) o dove serve un system prompt specialistico. Un eccesso di subagenti nasconde contesto all'agente principale e irrigidisce il flusso.

---

## 2. Architettura bersaglio: la pipeline

Otto stadi, ognuno produce un artefatto che il successivo consuma. I gate marcati (G) richiedono ok umano (tuo o del cliente).

```
S0 intake            → brief/brief.md                    (G)
S1 creative-director → brief/direction.md                (G)
S2 storyboarder      → brief/storyboard.md               (G)
S3 copy-chief        → content/*.json
S4 asset-wrangler    → public/assets/* + assets-manifest.json
S5 composizione      → blueprint-librarian sceglie e parametrizza,
                       gli specialisti implementano il custom
S6 qa-visiva         → qa/issues.md → loop di fix (max 3 giri)
S7 perf gate         → perf-fallback-auditor su budget    (G) → deploy Vercel
```

Regole di passaggio: nessuno stadio parte se l'artefatto precedente non esiste; ogni artefatto ha una checklist di completezza in coda; lo stato del progetto vive in `PIPELINE_STATUS.md` (stadio corrente, artefatti prodotti, gate superati), che è la prima cosa che ogni sessione di Claude Code legge.

---

## 3. Starter repo (`web3d-kit-starter`)

Uno solo, versionato, clonato a ogni progetto cliente. Dipendenze pinnate:

- next (App Router) + react 19 + typescript
- three (import da `three/webgpu` e `three/tsl`), @react-three/fiber v9, @react-three/drei
- gsap con ScrollTrigger, SplitText, ScrambleText (tutti gratuiti dal 30/04/2025)
- lenis (sincronizzato al ticker GSAP)
- tailwindcss per l'overlay DOM, katex, @gltf-transform/cli come devDependency

Renderer: WebGPURenderer con init asincrona nella prop `gl` di Canvas (pattern R3F v9) e fallback automatico a WebGL; tutti gli shader in TSL, mai GLSL puro, così un solo codice copre entrambi i backend. Su dispositivi deboli si degrada a poster statico per sezione.

Struttura:

```
/app                      route, layout, page transitions
/components/sections      i blueprint istanziati per il progetto
/webgl
  /scenes                 scena persistente, camera director
  /materials              shader TSL riusabili
  /rigs                   pointer-follow, float, bounding-box
/lib/motion               setup Lenis+GSAP, helper SplitText, useScrubTimeline
/registry                 IL REGISTRO: un folder per blueprint (vedi §4)
/content                  json di copy per sezione (slot)
/brief                    brief.md, direction.md, storyboard.md
/qa                       screenshot, issues.md
/scripts
  optimize-assets.mjs     gltf-transform: draco/meshopt + ktx2 + report pesi
  shoot.mjs               Playwright: screenshot per sezione × 3 breakpoint
  perf-check.mjs          budget bundle + Lighthouse
/.claude
  /agents  /skills  settings.json (hooks)
CLAUDE.md  PIPELINE_STATUS.md
```

`CLAUDE.md` del kit contiene: stack e versioni, convenzioni (una sola scena persistente, timeline sempre scrubbed, cleanup obbligatorio di ScrollTrigger e dispose delle risorse Three, reduced-motion sempre gestito), budget di performance, e la regola d'oro: prima di scrivere una sezione da zero, consultare il registro.

---

## 4. Il registro dei blueprint (la mossa Relume)

Ogni blueprint è una sezione parametrizzabile e già collaudata: componente React + eventuale modulo scena + `meta.json`. L'agente compone il sito scegliendo blueprint dal registro in base allo storyboard, come Relume compone wireframe dalla sua libreria. Schema di `meta.json`:

```json
{
  "id": "pinned-scene-scrub",
  "descrizione": "Sezione pinnata: la scena 3D si trasforma mentre l'utente scrolla",
  "trigger": ["scroll to continue", "trasformazione", "morph", "pin"],
  "props": { "model": "glb", "steps": "array di keyframe camera/materiali", "copy": "slot" },
  "slotCopy": ["eyebrow", "headline", "sub"],
  "perfTier": "C",
  "mobileFallback": "poster + timeline ridotta",
  "dipendenze": ["gsap/ScrollTrigger", "lenis", "webgl/scenes"]
}
```

I dodici blueprint iniziali, che coprono l'intero reel ORYZO più le tecniche trasversali del genere:

01 preloader-progress (caricamento asset reale, counter, sipario) · 02 hero-3d-split (split editoriale + GLB prodotto, sezione 1) · 03 mesh-gradient-field (gradient TSL animato full screen, sezione 2) · 04 pointer-rig-3d (oggetto che segue il puntatore, "try to hover", sezione 2) · 05 pinned-scene-scrub (sezione 3) · 06 kinetic-type (SplitText, display gigante, sezione 3) · 07 editorial-gallery (griglia magazine + parallax + reveal, sezione 4) · 08 spec-sheet-latex (KaTeX + footnote, sezione 5) · 09 interaction-card (decode/scramble, flip, magnetic button, sezione 6) · 10 display-statement (type nero su foto, eyebrow mono, sezione 7) · 11 horizontal-scroll-strip (galleria orizzontale pinnata) · 12 footer-cta (marquee + CTA magnetico + transizione d'uscita).

Regola di crescita: quando lo storyboard chiede qualcosa che il registro non copre, il blueprint-librarian apre una scheda "blueprint mancante", r3f-scene-architect lo costruisce per il progetto corrente e, se supera il QA, viene generalizzato e registrato. Il registro è l'asset aziendale che si compone progetto dopo progetto: è il tuo fossato, perché nessun builder no-code ha una libreria di sezioni 3D scroll-driven.

---

## 5. Nuovi agenti (`.claude/agents/*.md`)

Formato Claude Code: markdown con frontmatter YAML (name, description, tools, model). Sei nuovi, pronti da incollare. Gli esistenti restano, con una riga aggiunta al loro prompt: "Consulta sempre `brief/storyboard.md` e il registro in `/registry` prima di implementare; non reinventare ciò che esiste".

```markdown
---
name: creative-director
description: Usare all'inizio di ogni progetto sito, dopo il brief, per produrre brief/direction.md con art direction completa. Usare anche quando il QA segnala incoerenza estetica.
tools: Read, Write, Glob, Grep, WebFetch
model: opus
---
Sei il direttore creativo di uno studio che produce siti livello Awwwards.
Input: brief/brief.md. Output: brief/direction.md, e nient'altro.
direction.md deve contenere: 3 riferimenti visivi descritti a parole (niente asset altrui);
coppia tipografica (display + testo, con fallback variable font) e scala; palette con
token esadecimali e definizione del gradiente (colori, direzione, rumore); vocabolario
di motion (durate, easing, cosa si muove e cosa no); tono del copy (2 aggettivi + 1 divieto);
5 "non fare" specifici per questo progetto. Sii opinionato: una direzione sola, non tre
opzioni. Chiudi con la checklist di completezza spuntata.
```

```markdown
---
name: scroll-storyboarder
description: Usare dopo l'approvazione di direction.md per scrivere brief/storyboard.md, la sceneggiatura sezione per sezione dello scroll. È l'artefatto che guida tutta l'implementazione.
tools: Read, Write, Glob
model: opus
---
Sei uno sceneggiatore di esperienze scroll-driven. Input: brief.md + direction.md +
gli id disponibili in /registry (leggi tutti i meta.json). Output: brief/storyboard.md.
Per ogni sezione, nell'ordine di scroll: nome; blueprint suggerito dal registro (o
"CUSTOM" con descrizione); cosa fa la scena 3D (camera, oggetti, materiali, da stato A
a stato B); trigger e durata in viewport-height; slot di copy richiesti; comportamento
mobile e reduced-motion. La scena WebGL è UNA e persistente: descrivi le transizioni
tra sezioni, non sezioni isolate. Massimo 8 sezioni salvo richiesta diversa.
```

```markdown
---
name: copy-chief
description: Usare dopo lo storyboard per riempire gli slot di copy in content/*.json. Copy premium, in italiano o inglese secondo brief, con ironia controllata quando richiesta.
tools: Read, Write, Glob
model: sonnet
---
Sei un copywriter da brand premium. Input: storyboard.md + direction.md (tono).
Output: un json per sezione in /content, con esattamente gli slot richiesti dallo
storyboard (eyebrow, headline, sub, footnote, microcopy dei bottoni). Regole: headline
sotto le 6 parole; eyebrow in stile monospace, tecnico; footnote con asterisco se il
tono è satirico; mai gergo da AI, mai frasi fatte da agenzia. Verifica che ogni slot
esista nello storyboard: niente testo orfano.
```

```markdown
---
name: asset-wrangler
description: Usare quando servono asset 3D o immagini: definisce la lista, prepara i GLB e le texture con gli script del kit, produce assets-manifest.json. Usare PROATTIVAMENTE prima dello stadio di composizione.
tools: Read, Write, Bash, Glob
model: sonnet
---
Gestisci la pipeline asset. Input: storyboard.md. 1) Scrivi la lista asset necessari
(modelli, HDRI, foto) con specifiche: poligoni target, dimensioni texture, formato.
2) Per gli asset presenti in /public/assets/raw esegui scripts/optimize-assets.mjs
(gltf-transform: compressione Draco o Meshopt, texture KTX2, resize) e riporta i pesi
prima/dopo. 3) Genera i poster statici di fallback per ogni scena. 4) Scrivi
assets-manifest.json (path, peso, licenza, sezione di destinazione). Budget: GLB totali
sotto 5 MB, nessuna texture sopra 2048px salvo motivata eccezione. Se un asset manca,
scrivi il brief per procurarlo, non inventare percorsi.
```

```markdown
---
name: blueprint-librarian
description: Usare nello stadio di composizione: mappa ogni sezione dello storyboard su un blueprint del registro, lo parametrizza, segnala i CUSTOM mancanti. Usare anche a fine progetto per registrare i nuovi blueprint promossi.
tools: Read, Write, Glob, Grep
model: sonnet
---
Sei il bibliotecario del registro /registry. Input: storyboard.md. Per ogni sezione:
scegli il blueprint (match su trigger e descrizione nei meta.json), compila le props e
gli slot, scrivi il piano di composizione in brief/composition-plan.md con l'ordine di
implementazione e le dipendenze di scena condivise. Le sezioni CUSTOM vanno elencate a
parte con una specifica per r3f-scene-architect. A progetto chiuso: proponi quali CUSTOM
promuovere a blueprint, genera i loro meta.json e aggiorna l'indice del registro.
```

```markdown
---
name: visual-qa-operator
description: Usare dopo ogni build di pagina completa: naviga il sito con Playwright, scatta screenshot per sezione a 3 breakpoint, confronta con storyboard e direction, scrive qa/issues.md. Ripetere finché il report è pulito (max 3 giri).
tools: Read, Write, Bash, Glob
model: sonnet
---
Sei il QA visivo. 1) Avvia il dev server se non attivo. 2) Esegui scripts/shoot.mjs
(Playwright: scrolla la pagina fermandosi su ogni sezione, viewport 390/834/1440,
salva in /qa/shots con nome sezione-breakpoint, cattura anche gli errori console).
3) Guarda ogni screenshot e confrontalo con storyboard.md e direction.md: layout rotto,
testo che sborda, gerarchia tipografica, contrasto, stato della scena 3D coerente con
la sceneggiatura, fallback mobile presente. 4) Scrivi qa/issues.md: una voce per
problema con file screenshot, sezione, gravità (blocca/alta/bassa) e fix proposto.
Zero issues "blocca" = stadio superato. Non correggere tu il codice: riporta.
```

Aggiornamento del perf-fallback-auditor esistente: aggiungi al suo prompt i budget come gate numerici. JS iniziale sotto 300 KB gzip esclusi asset 3D; GLB totali sotto 5 MB; LCP sotto 2,5 s grazie al poster; 60 fps desktop e 30+ mobile sulle sezioni pinnate; DPR limitato a 2; `prefers-reduced-motion` disattiva scrub e autoplay; fallback WebGL verificato forzando `forceWebGL: true`.

---

## 6. Skills (`.claude/skills/<nome>/SKILL.md`)

Le skill portano il sapere procedurale del genere in ogni sessione, senza gonfiare CLAUDE.md. Quattro iniziali:

1. **awwwards-motion-patterns**: la grammatica del genere. Quando pinnare e quando no, scrub vs trigger, durate in vh, orchestrazione entrata/uscita, gestione FOUC, cleanup di ScrollTrigger su unmount, sync Lenis+GSAP (raf ticker unico).
2. **tsl-gradient-cookbook**: ricette TSL parametriche del tuo tsl-shader-engineer: mesh gradient a rumore 3D, reveal a maschera, flip/scramble shader, grana. Ogni ricetta con parametri esposti e nota sul costo.
3. **scroll-scene-choreography**: come tradurre una riga di storyboard in keyframe di camera/materiali; il pattern "camera director" (una timeline madre, sezioni come label); come far convivere DOM e canvas nello stesso scroll.
4. **client-intake**: il questionario S0 (settore, obiettivo, 3 riferimenti che piacciono e 1 che si odia, asset disponibili, lingue, deadline) e come compilarne brief.md.

Ognuna con frontmatter `name` e `description` scritta per il triggering automatico ("Usare quando...").

---

## 7. Loop di QA visiva

Il pezzo che trasforma il kit da "genera codice" a "vede quello che ha fatto", come Lovable e Bolt. Due vie, complementari:

- **Script deterministico** (`scripts/shoot.mjs`, usato dal visual-qa-operator): Playwright in Node, scroll programmato sezione per sezione, screenshot a 390, 834 e 1440, raccolta errori console e richieste fallite. Serve anche in CI.
- **Playwright MCP** collegato a Claude Code (`claude mcp add playwright ...` secondo la doc corrente): utile per l'esplorazione interattiva, quando vuoi che l'agente navighi e guardi in diretta, ad esempio in fase di ricognizione (§9).

Ciclo: build → shoot → visual-qa-operator scrive issues.md → l'agente principale smista i fix agli specialisti → nuovo shoot. Tre giri massimo, poi il problema sale a te.

---

## 8. Hooks e gate (`.claude/settings.json`)

Automazioni minime che tolgono discrezionalità:

- **PostToolUse** su Edit/Write di file `.ts/.tsx`: esegui `tsc --noEmit` e eslint sul file toccato; se falliscono, l'output torna all'agente per il fix immediato.
- **Stop/fine stadio**: uno script controlla `PIPELINE_STATUS.md` e stampa il comando del prossimo passo ("Usa il subagente scroll-storyboarder su brief/direction.md"), così sei tu a incollarlo: i gate restano umani, come nelle pipeline a subagenti ben fatte.
- **Gate perf** prima del deploy: `scripts/perf-check.mjs` (peso bundle, pesi da assets-manifest, Lighthouse su build di produzione); esito scritto in qa/perf-report.md, il deploy parte solo con il report verde.

---

## 9. Modulo di ricognizione: il reverse engineering lo fa il tuo Claude Code

Flusso ripetibile, da lanciare una volta a settimana o su un sito specifico che ti colpisce:

1. Input: URL (tipicamente un Site of the Day o un caso "made with Claude").
2. Con Playwright MCP l'agente apre la pagina, scrolla lentamente, scatta screenshot delle sezioni chiave.
3. Fingerprint tecnico via console del browser: `window.gsap?.version` e plugin registrati; presenza di Lenis (`window.lenis` o classi `lenis` sul root); canvas e contesto (webgl2 vs webgpu); indizi di framework (`__NEXT_DATA__`, attributi Nuxt/Svelte); font caricati; conteggio richieste GLB/KTX2/HDRI dal network.
4. Output: `recon/AAAA-MM-GG-dominio.md` con: stack rilevato, catalogo sezioni (tecnica per tecnica, nello stesso formato della tabella del dossier), 1-3 tecniche nuove candidate a blueprint, stima di sforzo.
5. Il blueprint-librarian aggiorna il backlog del registro.

Perimetro etico e legale, non negoziabile: si ispeziona solo ciò che il browser scarica comunque, si replicano tecniche e pattern, mai asset, copy, modelli 3D o design riconoscibili altrui. Il registro contiene solo codice tuo.

---

## 10. Flusso "richiesta cliente → sito", end to end

Giorno 1: intake (skill client-intake) → brief.md; creative-director → direction.md; mockup della direzione mandato al cliente (gate). Giorno 2: storyboard approvato; copy-chief e asset-wrangler in parallelo. Giorni 3-4: composizione dal registro + sezioni custom dagli specialisti; loop QA a fine giornata. Giorno 5: gate performance, fallback verificati, deploy su Vercel, handoff con un breve report (cosa è blueprint, cosa è custom, cosa è stato promosso a registro). Con il registro maturo, il target realistico per un one-pager tipo ORYZO è 3-5 giorni; le prime volte di più, perché stai costruendo il registro mentre consegni.

---

## 11. Prompt di bootstrap (incolla in Claude Code, nella cartella del kit)

```
Leggi per intero playbook-web3d-kit-claude-code.md e conferma di aver capito
pipeline, registro e agenti. Poi esegui in ordine, fermandoti a fine fase per il mio ok:

FASE 1 - Fondamenta. Crea lo starter repo come da §3 (Next + R3F v9 + three/webgpu
+ TSL + GSAP + Lenis + Tailwind, struttura cartelle completa, CLAUDE.md,
PIPELINE_STATUS.md). Scrivi scripts/optimize-assets.mjs, scripts/shoot.mjs e
scripts/perf-check.mjs. Verifica che `next build` passi.

FASE 2 - Sistema di agenti. Crea in .claude/agents i sei agenti della §5 e aggiorna
i sei esistenti con la riga sul registro. Crea le quattro skill della §6 con
contenuto reale (usa la tua conoscenza di GSAP/Lenis/TSL, versioni 2026).
Configura gli hook della §8.

FASE 3 - Primi blueprint. Implementa i blueprint 02 hero-3d-split, 03
mesh-gradient-field e 05 pinned-scene-scrub con meta.json, props documentate,
fallback mobile e reduced-motion. Componi una pagina demo con i tre in sequenza
su una scena persistente, con copy segnaposto in /content.

FASE 4 - Prova del loop. Lancia il visual-qa-operator sulla demo, correggi le
issues fino a report pulito, poi esegui il gate performance e mostrami i numeri.
```

Da lì in avanti, ogni nuovo sito parte con: clona lo starter, compila brief.md, e la pipeline della §2 fa il resto.

# PIPELINE_STATUS — dove siamo nella pipeline

> **Prima cosa che ogni sessione legge.** Aggiornarlo a ogni passaggio di stadio fa parte del
> "done" dello stadio. Le regole e i comandi della fabbrica sono in `CLAUDE.md` § The factory.

- **Progetto**: demo starter interno («Form in Motion»)
- **Stadio corrente**: **S6/S7 sulla demo interna** — 14 sezioni, **registro numerato COMPLETO
  15/15** (S2 storyboard ✓, S3 content ✓, S5 composizione ✓); nessun brief CLIENTE attivo
- **Ultimo aggiornamento**: 2026-09-10 (shelf React Bits riparata + catalogo 134 = 134; scaffale
  background per i reel DUOMO 26 ancora **non committato**; ROADMAP § 2 riverificato riga per
  riga — dettaglio in fondo). Prima di questo: 31 ago, merge train (Vite 8, tre gate qa,
  famiglia prodotto rinumerata 13·14·15)

| Stadio | Owner | Artefatto | Stato | Gate |
|---|---|---|---|---|
| S0 intake | skill `client-intake` | `brief/brief.md` | — | **umano** (cliente) |
| S1 direzione | `creative-director` | `brief/direction.md` + blocco tokens | — | **umano** |
| S2 storyboard | `scroll-storyboarder` | `brief/storyboard.md` | — | **umano** |
| S3 copy | `copy-chief` | `content/*.json` | — | checklist slot |
| S4 asset | `asset-wrangler` | `public/assets/*` + `assets-manifest.json` | — | budget `encode-assets` |
| S5 composizione | `blueprint-librarian` + specialisti | sezioni da `/registry` + custom | — | regola d'oro registro |
| S6 QA visiva | `visual-qa-operator` | `qa/issues.md` (max 3 giri) | — | zero issue «blocca» |
| S7 perf gate | `perf-fallback-auditor` | `qa/perf-report.md` | — | report verde → deploy |

Regole di passaggio: nessuno stadio parte se manca l'artefatto dello stadio precedente; i gate
umani si superano solo con OK esplicito; ogni artefatto chiude con la sua checklist spuntata.

**Debito JS iniziale: CHIUSO.** Era 604,8 KB gzip e il gate non poteva vederlo scendere, perché
sommava tutti i chunk e chiamava «iniziale» il totale. Ora `perf:check` cammina il **manifest di
Vite** dagli entry lungo i soli import statici (versione recuperata dal worktree `perf`, budget
150 target / 300 cap + guardia sul totale >700): **161,5 KB gzip iniziali** sulla demo unificata
a 12 sezioni (🟡 11,5 sopra il target; 431 differiti, 592,5 totali). Il salto viene
dall'inversione della dipendenza sul progresso di caricamento: `src/lib/loadProgress.ts`.

**Registro COMPLETO 15/15** (08 spec-sheet-latex e 10 display-statement chiusi il 31 ago: KaTeX
da import dinamico — l'entry non lo paga, +1,4 KB di componenti). Gate al 31 ago 2026:
`qa:state` 🟢 16/16 checkpoint sulla drammaturgia unificata · `qa:diff` 🟢 42/42 ·
`qa:reduced` 🟢 0 errori · `qa:verify` 🟢 WebGPU 0 errori console · `qa:frames` **bloccato
dall'ambiente su questo Mac**: mediana inchiodata a 33,3 ms su OGNI path e sezione, invariante
al throttle CPU 4× → tetto vsync/compositor a 30 Hz dello schermo, non carico dell'app (misura
del 31 ago; macchinario del gate operativo). Serve un giro su display a 60 Hz o device reale.

**Layer adattivo runtime: CHIUSO** (31 ago 2026, ROADMAP «Adaptive layer»):
`src/canvas/AdaptiveQuality.tsx` — PerformanceMonitor → setDpr dentro il range del tier
(un solo owner del dpr), AdaptiveEvents nel regress, flipflops=3 → resa al floor, spento con
`?qa=1` per il determinismo dei gate. + `src/hooks/useRenderBackend.ts` (la cucitura
backend.isWebGPUBackend per i feature-gate compute/post).

**P1 starter Next: CHIUSO** (31 ago 2026): `starters/next/` — App Router gemello, poster
server-rendered che vince l'LCP (h1 nell'HTML della prima risposta), canvas WebGPU dietro
`dynamic(ssr:false)` (three fuori dal server bundle e dal First Load: 120 KB senza scena),
route `/manifesto` solo-server, View Transitions CSS fra le route, `tokens:pull` come ponte
unico dai token del kit. Verificato: build statica 6/6, WebGPU nel browser reale, 0 errori.

**Debiti aperti**: TypeScript fermo alla 6 finché typescript-eslint non supporta la 7 (motivo in
`package.json` → `//versions`); `qa/baseline/` va rigenerata a ogni cambio voluto dell'aspetto
(`npm run qa:bless`) — e il merge train ha cambiato la pagina: baseline da ribenedire.

**Branch e worktree: nessuno aperto** (verificato il 10 set 2026). Il merge train del 31 ago ha
chiuso anche `feat/product-choreography` (`7146b7f`) e `gen-factory-lug10` (`02fac07`); i worktree
sono rimossi e `git worktree list` dà solo `main`. Resta il ramo `setup/auto-dispatch-agenti`
(20 giu) con **zero commit unici** rispetto a main: è un residuo, non un cantiere.
**`main` è 3 commit avanti su `origin/main`** — push non ancora fatto.

## 3-10 set 2026 — dopo il merge train

- **I gate dichiarano di essere stati visti fallire** (`becdfce`, `77d1111`): marcatore
  `GATE-NEGATIVO:` su `perf-check` e sui tre gate — un gate che nessuno ha mai visto fallire non
  è un gate.
- **Shelf React Bits riparata** (`ad38b20`, 9 set): `SideRays.tsx` conteneva **due copie complete
  del componente concatenate** (470 righe, due `export default`) — unico caso su 135 file, provato
  con un typecheck dell'intera shelf. Perché era sopravvissuto: `CATALOG.md` elencava 130 voci
  contro 134 cartelle, e **chi non è a catalogo non viene mai aperto**. Ora 134 = 134,
  `sync:global` rieseguito (il mirror conteneva ancora il file a 470 righe). Restano 4 componenti
  con attrito di tipi vero, segnalati e non toccati: `Dither`, `Lanyard`, `PillNav`,
  `SplitText`/`Shuffle`.
- **Due scaffalature per i reel DUOMO 26 — NULLA committato** (9 set): `lib/backgrounds/` (indice
  di 29 sorgenti con licenza e verdetto, `bg:links`/`bg:fetch`), la galleria `lab/bg-gallery/`
  fuori da `src/` con 47 background catturati a 1080×1920, e la guardia `bg:doctor` (confronta
  ogni prop numerica col default del componente e boccia oltre 10×; al primo giro ha trovato 4
  valori fuori scala). Il lab non entra nel bundle; lint + build + `perf:check` verdi. **Sono
  file non tracciati su `main`.**
- **ROADMAP § 2 riverificato** (10 set): la tabella «Where we are» era ferma alla fotografia
  pre-W1 del 20 giu e diceva «Missing» su aree chiuse a luglio e agosto. Riscritta riga per riga
  aprendo i file, con la distinzione che conta — **prodotto vs realism lab** (`?lab=1`):
  instancing, PBR triplanar, PostFX, wind e physics esistono e sono verificati, ma **nessuno è
  montato in una sezione**, quindi nessuno è mai passato dai gate del prodotto. Le righe
  `Current:` del § 5 restano lo stato d'ingresso, ora dichiarato tale.

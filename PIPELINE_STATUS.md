# PIPELINE_STATUS — dove siamo nella pipeline

> **Prima cosa che ogni sessione legge.** Aggiornarlo a ogni passaggio di stadio fa parte del
> "done" dello stadio. Le regole e i comandi della fabbrica sono in `CLAUDE.md` § The factory.

- **Progetto**: demo starter interno («Form in Motion»)
- **Stadio corrente**: **S6/S7 sulla demo interna** — 9 blueprint composti (S2 storyboard ✓,
  S3 content ✓, S5 composizione ✓ da `brief/composition-plan.md`); nessun brief CLIENTE attivo
- **Ultimo aggiornamento**: 2026-08-06 (branch `feat/velocity-ago2026` — Vite 8, code-split reale,
  manopole in `looks/`, gate visivo numerico, blueprint 07·09·11·12)

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
sommava tutti i chunk e chiamava «iniziale» il totale. Ora `perf:check` legge da `dist/index.html`
lo script d'ingresso più i suoi `modulepreload`, cioè il percorso critico vero:
**157,5 KB gzip iniziali** (429,7 differiti, 587,2 totali) — sotto il target di 300, gate 🟢.
Il salto viene dall'inversione della dipendenza sul progresso di caricamento, non da un Next
starter: vedi `src/lib/loadProgress.ts` e `docs/README.md`.

**Registro a 9/12 blueprint** (01·02·03·05·06·07·09·11·12); mancano 04 (sul branch `gen-factory`),
08, 10.

**Debiti aperti**: TypeScript fermo alla 6 finché typescript-eslint non supporta la 7 (motivo in
`package.json` → `//versions`); la copia di `qa/baseline/` va rigenerata a ogni cambio voluto
dell'aspetto (`npm run qa:bless`).

**Branch aperti**: `gen-factory-lug10` (worktree `.claude/worktrees/gen-factory`, 10 lug) —
blueprint **04-pointer-rig-3d implementato** + layer «generative factory» (4 agenti nuovi,
2 skill, intake a 3 porte S0a/b/c, backlog 13-18, master plan). **NON mergiato**: serve review
+ OK umano esplicito prima del merge.

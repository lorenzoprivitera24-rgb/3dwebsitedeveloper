# `docs/` — la memoria strategica del kit

Perché il kit è fatto così. Si legge quando si mette in discussione un pezzo di architettura o si
valuta una libreria nuova — **non** a ogni sessione: `CLAUDE.md` rimanda qui apposta, per non pagare
questa storia in contesto tutte le volte.

## Il corpus di reverse engineering (lug 2026)

La fabbrica — registro dei blueprint, stadi S0-S7, giro di QA visiva, cancello di performance —
discende da una ricognizione sui riferimenti del genere: **framer.com, threejs.paris, poch.studio,
ylem.watch** (8-9 luglio 2026).

| File | Cosa contiene |
|---|---|
| [`dossier-reverse-engineering-web3d.md`](dossier-reverse-engineering-web3d.md) | come Framer/Webflow/Relume/v0 producono su richiesta |
| [`playbook-web3d-kit-claude-code.md`](playbook-web3d-kit-claude-code.md) | i cambiamenti che la ricognizione ha prescritto |
| [`gap-analysis-2026-07-09.md`](gap-analysis-2026-07-09.md) | mappa have/gap su 20 variabili + la sequenza concordata |
| [`deep-dive-stack-e-librerie-asset.md`](deep-dive-stack-e-librerie-asset.md) | approfondimento su stack e librerie di asset |
| [`inspiration/`](inspiration/) | riferimenti visivi (Mobbin è solo consultazione: screenshot a pagamento, niente da vendorizzare) |
| `../recon/` | i rapporti grezzi per sito |

`scripts/recon-fingerprint.mjs` è rieseguibile: **rilanciala** quando valuti una libreria nuova o
sospetti che il genere si sia spostato. Consulta il corpus prima di cambiare lo stack.

## Le decisioni che non si vedono nel codice

**Perché il layer 3D entra da un import dinamico.** Con un import statico il chunk `three` finisce
in `<link modulepreload>` e il code-split diventa cosmetico: misurati 599 KB gzip comunque sul primo
paint. L'inversione (store senza dipendenze + ponte dal chunk del canvas) porta l'ingresso a
156,5 KB gzip, −74%. Il racconto completo è in [`src/lib/loadProgress.ts`](../src/lib/loadProgress.ts).

**Perché i numeri estetici stanno in `looks/`.** Accordarli via prompt costa un giro completo di
build-screenshot-giudizio ciascuno; via manopola costa un movimento del polso, e decide chi ha il
gusto. Vedi [`looks/README.md`](../looks/README.md).

**Perché il gate visivo stampa percentuali.** Un PNG letto da un modello costa ~1.700 token; il giro
completo ne costa ~25.000. `npm run qa:diff` li riduce a quindici righe e fa salire l'immagine solo
quando serve. Le soglie sono rumore **misurato**, non tolleranze scelte a occhio:
[`qa/diff-budget.json`](../qa/diff-budget.json).

**Perché TypeScript è fermo alla 6.** La 7 (Go-native, 8 lug 2026) è ~10× più veloce, ma
`typescript-eslint@8` dichiara `typescript <6.1.0` e qui il lint gira a ogni edit via hook. Si sale
quando typescript-eslint supporta la 7 — serve l'API programmatica stabile attesa in TS 7.1.

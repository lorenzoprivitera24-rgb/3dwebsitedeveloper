# brief/ — gli artefatti che guidano la build

Qui vive la catena S0→S2: `brief.md` (intake) → `direction.md` (art direction + tokens) →
`storyboard.md` (sceneggiatura dello scroll) → `composition-plan.md` (mappa storyboard→registro,
scritto dal blueprint-librarian in S5). Ogni file nasce dal template in `_templates/` e chiude
con la sua checklist spuntata. Nessun file qui = la pipeline non è partita.

- `direction.md` contiene il **blocco ```json tokens** che `npm run tokens:build` compila in
  `src/styles/tokens.css` + `src/lib/tokens.generated.ts`: DOM e canvas leggono la stessa fonte.
- I gate S0/S1/S2 sono umani: si passa solo con OK esplicito (cliente o Lorenzo).

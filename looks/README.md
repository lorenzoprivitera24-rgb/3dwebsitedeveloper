# `looks/` — i numeri accordati a occhio

Un file per sezione, gemello di `content/<sezione>.json`. Lì vive **cosa dice** la sezione; qui
**come è tarata**: ampiezze, scale del rumore, bias, influenza del puntatore.

## La regola

> Se un valore si accorda guardando lo schermo, non sta nel codice: sta qui, e ha una manopola.

Nasce da un conto preciso. Un giro di «abbassa un po' l'ampiezza / scalda il fondo» costa un
prompt, una modifica, una build, uno screenshot e un giudizio — migliaia di token, minuti di attesa,
e va ripetuto finché il pixel è giusto. Con la manopola costa un movimento del polso, in tempo reale,
e chi decide è chi ha il gusto. Il modello scrive la **struttura**; l'accordatura è di chi guarda.

I commenti tipo «0.22 tiene la notte della direction (QA giri 1-2)» sono la prova archeologica del
problema: erano tarature umane cementate in una costante, raggiungibili solo riscrivendo il file.

## Come si usa

1. `npm run dev`, apri il pannello **Look** in alto a destra (solo in dev — in produzione il codice
   non viene nemmeno compilato: `import.meta.env.DEV` è staticamente `false` e Rolldown lo elimina).
2. Gira le manopole guardando la scena. Nessun reload: scrivono direttamente sulle uniform TSL.
3. **Copia preset** mette il JSON negli appunti; incollalo in `looks/<sezione>.json` e committa.

Il valore di partenza è sempre quello del file: il pannello non inventa nulla, mostra ciò che è
scritto. Se una manopola non esiste, il valore è ancora cementato nel codice — è un debito.

## Perché non nei token

`tokens.generated.ts` è generato da `brief/direction.md` (stage S1) e non si tocca a mano: contiene
le decisioni di **marca** (colori, tipografia, spazi). Qui invece stanno i parametri di **resa** di
una singola sezione, che non hanno senso fuori da lei e cambiano con la messa a punto.

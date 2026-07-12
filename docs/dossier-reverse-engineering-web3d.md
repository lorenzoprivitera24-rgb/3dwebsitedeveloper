# Dossier: il genere "made with Claude" e come i leader lo producono a richiesta

Data: 8 luglio 2026
Commissionato per: kit Web3D di Amplio Flow (Claude Code)
Obiettivo: capire (a) come è costruito tecnicamente il genere di sito mostrato nel reel ORYZO e (b) come Framer, Webflow, Relume e i generatori code-first riescono a produrre siti "a richiesta del cliente" tramite agenti che lavorano su uno stack vincolato. Il documento gemello, il playbook, traduce tutto questo in modifiche concrete al tuo kit.

---

## 1. Il bersaglio: la firma tecnica del genere ORYZO

Il sito del reel appartiene a un genere preciso, quello dei siti da Awwwards / FWA: una sola scena WebGL persistente che si trasforma sezione dopo sezione, scroll come timeline narrativa, tipografia editoriale enorme, micro-interazioni pilotate dal puntatore, copy premium con ironia controllata. Non è un tema, è una coreografia. La struttura ricorrente:

1. Un canvas WebGL fisso a tutto viewport, sotto o sopra il DOM, che vive per tutta la pagina. Le "sezioni 3D" non sono canvas separati: è la stessa scena che cambia camera, materiali e oggetti in base alla posizione di scroll.
2. Lo scroll è normalizzato da uno smooth scroller (Lenis o ScrollSmoother) e sincronizzato con GSAP ScrollTrigger: ogni sezione ha una timeline "scrubbed", cioè legata pixel per pixel alla posizione, non a trigger on/off.
3. Il DOM sopra il canvas fa il lavoro editoriale: griglia 12 colonne, display type gigantesco, eyebrow in monospace, footnote, formule KaTeX. Il 3D e il testo si parlano tramite lo stesso storyboard.
4. Il puntatore è un input di scena: uniform lerped che ruotano un rig 3D, deformano uno shader, muovono un cursore custom, rendono "magnetici" i bottoni.

Mappa delle sette sezioni catalogate dal reel, con la tecnica esatta e il modulo del kit che la copre:

| # | Sezione ORYZO | Tecnica | Componenti stack | Agente kit competente |
|---|---|---|---|---|
| 1 | Hero "Isn't just a coaster" | GLB del prodotto in scena R3F, HDRI, layout split editoriale, display type | R3F + drei (useGLTF, Environment, Float) | r3f-scene-architect |
| 2 | "Powered by AI*" | Mesh gradient animato full screen (quad + noise 3D), mano 3D che segue il puntatore | Shader TSL su quad, rig con lerp verso pointer normalizzato | tsl-shader-engineer + interaction-engineer |
| 3 | "It's wearable" | Sezione pinnata, timeline scrubbed su scroll, tipografia cinetica, bounding box wireframe | ScrollTrigger pin + scrub, SplitText per char, BoxHelper estetico | scroll-motion-engineer |
| 4 | Gallery | Griglia magazine, parallax differenziale, reveal a maschera sulle immagini | CSS grid + ScrollTrigger, clip-path o shader reveal | ui-overlay-a11y-engineer |
| 5 | "Thermodynamic stability" | Immagine FLIR trattata, formula renderizzata, footnote satirico | KaTeX, micro-tipografia | ui-overlay-a11y-engineer |
| 6 | "Smart flip encryption" | Flatlay, bottone "decode message" con scramble del testo | ScrambleTextPlugin (ora gratuito) o flip shader | interaction-engineer |
| 7 | "Sustainability" | Display type nero gigante su foto, eyebrow mono | Sistema tipografico, mix-blend-mode | ui-overlay-a11y-engineer |

A queste si aggiungono le tecniche trasversali che il genere dà per scontate e che il reel non inquadra ma contiene: preloader con progresso reale degli asset, cursore custom, transizioni di pagina, grana/bloom in post-processing, degrado controllato su mobile e prefers-reduced-motion.

Lettura strategica: nessuna delle sette sezioni è difficile presa da sola. Il valore, e la ragione per cui il reel accredita Claude, sta nella coreografia complessiva e nella coerenza di art direction. È questo che il tuo kit deve imparare a produrre in modo ripetibile.

---

## 2. Lo stack 2026 del genere

Le scelte correnti di chi produce questi siti, con le novità rilevanti dell'ultimo anno:

**Motion.** GSAP è diventato completamente gratuito il 30 aprile 2025, plugin Club compresi, dopo l'acquisizione da parte di Webflow dell'ottobre 2024. SplitText, ScrollTrigger, ScrambleText, MorphSVG, DrawSVG, ScrollSmoother: tutto libero, anche fuori da Webflow. Questo azzera il costo di licenza del tuo kit e rende GSAP la scelta di default senza riserve. Lenis (darkroom.engineering) resta lo smooth scroller più usato nel genere, sincronizzato al ticker GSAP; ScrollSmoother è ora un'alternativa gratuita legittima.

**3D.** Three.js con WebGPURenderer e TSL è passato da esperimento a opzione di produzione: TSL si scrive in JavaScript e compila sia in WGSL (WebGPU) sia in GLSL (WebGL), quindi un solo codice shader copre entrambi i renderer, con fallback automatico a WebGL dove WebGPU manca. React Three Fiber v9 (React 19) supporta l'inizializzazione asincrona del renderer tramite la prop `gl`, che è esattamente il pattern richiesto da WebGPURenderer. Avvertenza pratica: il supporto WebGPU in R3F è ancora in maturazione su alcuni dettagli (post-processing, edge case), quindi la strategia giusta è TSL come linguaggio unico e WebGL2 come pavimento garantito, non WebGPU come requisito.

**Resto della filiera.** Next.js (App Router) per struttura e deploy Vercel, che è già la tua pipeline. Tailwind per l'overlay DOM. pmndrs/postprocessing o il nuovo PostProcessing nativo di Three per grain e bloom. KaTeX per le formule. gltf-transform in CLI per comprimere i GLB (Draco o Meshopt) e convertire le texture in KTX2. drei per i mattoni R3F (useGLTF, Environment, Html, ScrollControls quando serve).

---

## 3. Come i leader lo producono "a richiesta": agenti su uno stack vincolato

Qui sta la parte che ti interessa davvero. Nessuno dei leader genera siti "dal nulla": tutti hanno costruito un sistema in cui un agente compone dentro vincoli proprietari. La tua intuizione era corretta e va formalizzata.

### Framer

Framer nel 2026 ha smesso di vendere singole feature AI e vende un flusso di agenti. Wireframer, il generatore di struttura di pagina, è stato assorbito nel workflow dell'agente AI: chiedi all'agente un wireframe e lui genera struttura, layout, copy e breakpoint direttamente sul canvas, dentro il design system del progetto. Workshop, l'assistente che genera code component React via prompt, gira su Claude 4.5 da settembre 2025 ed è la porta da cui un sito tipo ORYZO entrerebbe in Framer: come code component embeddato, non come output nativo del builder. Sopra tutto questo, Framer ha lanciato un plugin MCP (bring your own LLM: colleghi Claude Desktop o Cursor e gli fai gestire CMS, SEO, esperimenti di pagina) e a maggio 2026 una beta "Claude & Codex for Framer" che porta il controllo del canvas direttamente al tuo LLM. Il segnale strategico è enorme: il leader del no-code sta ammettendo che il futuro è un agente esterno (Claude) che pilota il loro stack. Tu stai costruendo la stessa cosa, ma possiedi anche lo stack.

Il limite documentato di Wireframer conferma la tesi: output forte come primo draft, ma rotture su mobile, layout generici, rifinitura umana obbligatoria. La generazione libera senza libreria curata produce il "pavimento", mai il "soffitto".

### Webflow

Webflow ha fatto due mosse complementari. La prima: l'AI Site Builder non genera HTML libero ma compone dentro Flowkit, il loro framework CSS modulare proprietario, con design system, otto categorie di stile editabili e preset di animazione GSAP. L'output è vincolato per costruzione, quindi editabile, coerente e scalabile. La seconda: dopo l'acquisizione di GSAP, Webflow ha ricostruito le proprie Interactions native sopra GSAP, con SplitText, stagger e ScrollTrigger disponibili visualmente, interazioni scopate ai componenti e persino gestione automatica del FOUC e del prefers-reduced-motion. Traduzione: il motore di animazione del genere Awwwards è diventato l'infrastruttura ufficiale del più grande builder. Chi lo sa usare in codice, come il tuo kit, parte comunque un gradino sopra la versione visuale.

### Relume, il modello da copiare

Relume è l'esempio più pulito di "agenti con uno stack che lavorano a richiesta", ed è l'architettura che il playbook ti fa replicare. Il flusso: descrivi l'azienda e gli obiettivi in poche frasi; l'AI genera la sitemap; ogni sezione della sitemap ha titolo e descrizione che funzionano da "section prompt"; da quei prompt l'AI compone i wireframe pescando da una libreria proprietaria di oltre 1000 componenti reali, responsive e già ottimizzati per la conversione, scrivendo anche il copy; poi Style Guide Builder applica il design system e si esporta verso Figma, Webflow o React. Sitemap e wireframe sono legati in modo bidirezionale: cancelli una sezione da una parte, sparisce dall'altra.

Il punto architetturale: l'intelligenza di Relume non sta nel modello linguistico, sta nella libreria e nella mappatura section prompt → componente. L'AI non inventa layout, seleziona e parametrizza. È il motivo per cui l'output è affidabile e il motivo per cui il tuo kit, che oggi ha agenti bravi ma nessuna libreria di sezioni, produce risultati incostanti. Nota a margine gustosa: Relume stessa oggi pubblicizza la possibilità di mandare il proprio design system "direttamente dentro Claude".

Il limite dichiarato di Relume è anche la tua opportunità: la libreria copre i pattern convenzionali del marketing site e si ferma davanti a layout sperimentali e interazioni non convenzionali. Cioè esattamente il territorio ORYZO. Nessun leader no-code ha una libreria di sezioni 3D scroll-driven. Quella libreria la costruisci tu.

### I generatori code-first (v0, Lovable, Bolt)

La stessa lezione, vista dal lato codice. v0 di Vercel è volutamente rigidissimo: React, Tailwind, shadcn/ui e basta; quella rigidità compra qualità e coerenza dell'output. Lovable genera app complete ma sempre sullo stesso stack fisso (React, TypeScript, Tailwind, shadcn, Supabase) con preview live e loop di auto-correzione. E il fenomeno shadcn/ui con Registry 2.0 ha trasformato il modello "registro di componenti installabili" in infrastruttura: registri interni, registri di terze parti, blocchi a migliaia, tutti consumabili dagli agenti (v0, Lovable, Bolt, Cursor e Claude Code generano shadcn di default). Tre pattern ricorrono in tutti: stack fisso e opinionato; libreria/registro curato da cui comporre; ambiente eseguibile con segnali di feedback (errori console, preview, screenshot) che rientrano nell'agente.

---

## 4. I sei principi estratti (perché la tua base non basta)

1. **Stack vincolato batte generazione libera.** Ogni leader ha inchiodato il proprio stack (Flowkit, canvas Framer, shadcn). Il tuo kit deve avere uno starter repo pinnato, non "un progetto Next da zero ogni volta".
2. **La qualità minima la garantisce la libreria, non il modello.** Relume compone da 1000 componenti, v0 da shadcn. Il tuo kit ha bisogno di un registro di blueprint di sezione 3D parametrizzabili. Oggi non ce l'ha: gli agenti reinventano ogni volta, ed è lì che nasce l'incostanza.
3. **Pipeline a stadi con artefatti intermedi.** Brief, direzione creativa, storyboard, token, build, QA: ogni stadio produce un file che lo stadio dopo consuma e che il cliente può approvare. Relume lo fa con sitemap → wireframe → style guide. Il tuo flusso attuale parte troppo spesso dall'implementazione.
4. **Loop di feedback chiuso.** Lovable e Bolt correggono da soli perché vedono errori e preview. Il tuo Claude Code deve guardare il sito renderizzato (screenshot Playwright per sezione e breakpoint) e confrontarlo con lo storyboard, non fidarsi del codice che compila.
5. **Il gusto va reso esplicito.** L'art direction (coppie tipografiche, palette e gradienti, vocabolario di motion, riferimenti) deve diventare un artefatto (direction.md) e una skill, non restare implicita nella testa di chi prompta. È la differenza tra un sito corretto e un sito da Awwwards.
6. **Gli asset sono una pipeline.** GLB compressi, KTX2, HDRI, poster di fallback: se non c'è un agente e uno script che li produce e li verifica, il perf-fallback-auditor arriverà sempre troppo tardi.

Il playbook allegato applica questi sei principi al tuo kit: gap analysis agente per agente, starter repo, registro blueprint, sei nuovi agenti pronti da incollare in `.claude/agents/`, loop QA con Playwright, gate di performance e un modulo di ricognizione continua con cui il tuo Claude Code smonta da solo i siti premiati e alimenta il registro.

---

## 5. Fonti principali

- Framer, pagina Wireframer/AI agents: framer.com/wireframer
- Analisi delle superfici AI di Framer 2026 (Workshop su Claude 4.5, plugin MCP, beta Claude & Codex, Framer 3.0): oma-kase.com/blog/framer-ai-features e superdesign.dev/blog/framer-ai-review
- Webflow, GSAP diventa gratuito (30 aprile 2025): webflow.com/blog/gsap-becomes-free
- Webflow, Interactions with GSAP e AI Site Builder su Flowkit: help.webflow.com e webflow.com/ai-site-builder
- Relume, docs Site Builder (sitemap, section prompt, wireframe, libreria 1000+ componenti): relume.io/resources
- v0 vs Lovable e il modello a stack fisso: mindstudio.ai/blog/what-is-vercel-v0, annaarteeva.medium.com (confronto stack AI)
- shadcn/ui e Registry 2.0 come infrastruttura degli agenti: shadcndeck.com/blog/rise-of-shadcn-ui-2026
- Three.js WebGPU/TSL e migrazione 2026: utsubo.com/blog/webgpu-threejs-migration-guide, blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu
- React Three Fiber v9 migration guide (gl prop asincrona, WebGPURenderer): r3f.docs.pmnd.rs/tutorials/v9-migration-guide
- Claude Code, subagenti e pipeline: code.claude.com/docs/en/sub-agents, pubnub.com/blog/best-practices-for-claude-code-sub-agents

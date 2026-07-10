# Master plan — Web3D Kit → fabbrica generativa completa (10 luglio 2026)

> Obiettivo di Lorenzo: da (A) immagine+prompt, (B) sito vecchio+prompt, o (C) solo prompt,
> Claude Code produce siti 3D di nuovissima generazione — interazioni, motion, gamification,
> realismo, scomposizione/animazione del brand esistente, profondità, ecosistemi — con pari
> impatto mobile/desktop e gusto luglio 2026.

## A. Dove siamo (verificato sul filesystem, 10 lug)

- Settimane 1-4 CHIUSE: pavimento realismo (IBL+AgX+KTX2), fabbrica S0-S7 con 12 agenti + 5
  skill, token-bridge, QA loop (`qa:shoot` 390/834/1440 + `perf:check`), registro **5/12**
  (01, 02, 03, 05, 06) composti nella demo, QA 3 giri PASS.
- Aperti confermati: **7 blueprint mancanti** (04, 07-12) + 3 backlog recon; **code-split
  assente** (JS 596KB vs target 300KB gz — gate S7 🟡); **rapier non è dipendenza**; niente
  starter Next / View Transitions; S0 accetta solo il flusso "cliente che risponde al
  questionario" (nessun ingresso da immagine o da sito esistente); **il logo del cliente non ha
  alcuna presa in carico 3D** (entra solo come asset in S4).

## B. Cosa dice la ricerca (luglio 2026) — 8 assi

1. **Trend estetici**: il 3D immersivo è mainstream (e-commerce/SaaS, non solo agency); static
   hero = datato. Dominano: kinetic typography (il testo si muove, reagisce, si allunga sullo
   scroll), broken grids + visual personality, dopamine design (saturi, neon gradient,
   alto contrasto) accanto al filone cinematografico scuro, scrollytelling maturo, audio
   spazializzato, "purpose-driven UX" + Core Web Vitals estremi. Bruno Simon 2025 = SOTM
   gennaio 2026: il mondo esplorabile è di nuovo l'apice del genere.
2. **Motion/interazioni**: GSAP 100% gratis (SplitText riscritto: -50% peso, a11y nativa,
   masking); View Transitions same-document = Baseline (Chrome 111+/Safari 18+/Firefox 144);
   cross-document Chrome 126 + Safari 18.2 (Firefox dietro flag → progressive enhancement).
   Pattern-firma 2026: **cursore come strumento** (trail texture → influence map → shader, es.
   Podium/OHZI), reveal char-by-char irregolare, hover "pixel-like" sottile, parallax
   multi-piano narrativo.
3. **WebGPU**: massa critica raggiunta — Chrome 113+, Firefox 141/145, **Safari 26 su
   macOS/iOS/iPadOS/visionOS** (annuncio "tutti i browser" nov 2025). ~70% utenti su path
   WebGPU con fallback WebGL2 per il resto. La scommessa WebGPU-first del kit è vinta.
4. **Realismo**: Gaussian splats production-ready nel 2026 (Zillow, Apartments.com):
   **Spark** (WebGL2, mobile-first, formato .spz Niantic) o GaussianSplats3D (.ksplat);
   regola: <3M gaussiane per mobile. Volumetric lighting ufficiale negli esempi three.js
   WebGPU (half-res + bilateral upsampling + temporal reprojection); god rays "fake" (cone
   mesh additivo) per il tier basso. TSL compute maturo: boids, galassie, immagine→particelle
   (pattern "Milkmaid" Revelium: sample colori → particle cloud che tiene la composizione).
5. **Gamification**: tassonomia utile = easter egg (curiosity reward), esplorazione libera
   (drivable world), fisica giocabile (crash/bounce sandbox), cursor-as-game-tool,
   progressione narrativa a scroll. Richiede @react-three/rapier (+ ecctrl per character).
   Rischi: perf mobile, a11y (sempre percorso alternativo non-gioco), reduced-motion.
6. **Brand→3D**: filiera matura — SVGLoader+ExtrudeGeometry (bevel/materiali/luci),
   morphing path-based (anchor points comparabili), **particle assembly del logo**
   (scomposizione→ricomposizione, compute), logo come influenza fluida. Tool browser
   SVG→GLB esistono; il valore per il kit è la RICETTA parametrica, non il tool.
7. **Img-to-site**: v0/Bolt ~72% accuratezza screenshot→code; **estrazione design system da
   sito live via Playwright computed styles** (dembrandt, MiroMiro): palette con confidenza,
   raggruppamento typography, pattern spacing → token. Il nostro token-bridge
   (direction.md → CSS vars + uniform TSL) è già il punto d'aggancio: basta alimentarlo
   da monte. Limite noto: il giudizio estetico resta umano → i gate S0/S1 non si toccano.
8. **Device parity**: iOS 26 chiude il divario API; la parità si fa con **stessa regia,
   budget diversi** (tier che scala densità/post-FX, mai la narrativa), input mapping
   esplicito (hover→touch/gyro con permessi), dynamic resolution scaling, e QA che misura
   la parità (throttling CPU + budget per breakpoint), non solo screenshot.

## C. Il piano — 3 assi

### Asse 1 — Completare il corpo: registro + debito

| Cosa | Note | Effort |
|---|---|---|
| Template blueprint standard | scaffold `registry/_template/` (meta.json + README + sezione + checklist QA) prima di farne altri 7 | S |
| Blueprint 04 pointer-rig-3d | oggetto segue puntatore; damp + touch fallback (gyro opzionale) | S |
| Blueprint 07 editorial-gallery | griglia magazine + parallax + reveal; slot immagini da manifest | M |
| Blueprint 08 spec-sheet-latex | KaTeX + footnote; solo DOM | S |
| Blueprint 09 interaction-card | decode/scramble, flip, magnetic (riuso React Bits) | S |
| Blueprint 10 display-statement | type gigante su foto, eyebrow mono | S |
| Blueprint 11 horizontal-scroll-strip | galleria orizzontale pinnata; gotcha pin-spacer CLS | M |
| Blueprint 12 footer-cta | marquee + CTA magnetico + uscita | S |
| Code-split | manualChunks (three/webgpu, gsap, react) + lazy per sezione sotto la fold; target <300KB gz iniziale | M |
| rapier come optional-dep documentata | serve all'asse gamification | S |

**Nuovi blueprint ricerca-driven (13-18)** — dopo i 7, a trascinamento progetti:
13 `logo-hero-3d` (i 3 trattamenti brand), 14 `ambient-ecosystem` (boids/particelle ambientali
tier-gated), 15 `volumetric-atmosphere` (god rays fake→veri per tier + fog layering),
16 `playable-physics` (rapier sandbox), 17 `splat-hero` (Spark/.spz — corsia fotoreale),
18 `vt-page-transition` (sipario View Transitions).

### Asse 2 — Le tre porte d'ingresso generative (S0 multi-modale)

```
A) immagine + prompt   → S0b intake-da-immagine  → brief/reference-analysis.md
B) sito vecchio+prompt → S0c autopsia-sito       → brief/legacy-audit.md (+ fingerprint recon)
C) solo prompt         → S0a intake compresso    → brief/brief.md con default dichiarati
                            ↘ tutti convergono su S1 (creative-director, gate umano) ↙
```

- **S0b**: da screenshot/moodboard estrarre palette (con confidenza), coppia type implicita,
  layout grid, mood/motion implicito, materiali 3D suggeriti → `reference-analysis.md`
  che S1 consuma come vincolo. L'immagine NON diventa il sito: diventa token + direzione.
- **S0c**: script `scripts/site-autopsy.mjs` (riusa recon-fingerprint.mjs): scarica il sito
  vecchio, estrae contenuti/IA (nav, sezioni, copy riusabile), computed-style tokens,
  asset (logo!), Lighthouse baseline → `legacy-audit.md` con verdetto tieni/butta per blocco.
- **S0a**: il questionario esistente resta il gold standard; per "solo prompt" senza cliente
  in call, la skill compila il brief con default espliciti e li marca `[DEFAULT]` (il gate
  umano vede cosa ha deciso la macchina).
- **`scripts/extract-brand.mjs`**: da logo SVG/PNG + eventuale sito → brand kit
  (`brief/brand-kit.json`: palette, font rilevati, logo path normalizzati, safe-area) —
  input sia per S1 sia per il blueprint 13.

### Asse 3 — Il cervello: nuovi agenti, skill, auto-trigger

**Nuovi agenti** (in `.claude/agents/`, stesso stile dei 12):
1. `brand-alchemist` — possiede la filiera brand→3D: parsing SVG, estrusione premium,
   scomposizione particellare, trattamento fluido, brand motion system (easing/durate dal
   carattere del brand). Delega shader complessi a tsl-shader-engineer. Trigger IT: "anima il
   logo", "logo 3D", "scomponi il brand", "il logo si ricompone".
2. `world-builder` — possiede profondità e vita del background: multi-piano + fog layering,
   DoF narrativo, particelle ambientali/boids, agenti autonomi di sfondo, atmosfere
   (god rays per tier). Trigger IT: "sfondo vivo", "ecosistema", "profondità", "atmosfera",
   "mondo che respira".
3. `gameplay-engineer` — possiede la gamification: rapier, easter eggs, esplorazione libera,
   cursor-game, progressione a scroll; ogni meccanica con percorso alternativo accessibile.
   Trigger IT: "gamification", "giocabile", "easter egg", "esplorabile", "mini-gioco".
4. `device-parity-director` — possiede la REGIA della parità (in fase di design, non solo
   audit finale): mappa ogni wow-moment desktop→mobile, input mapping (hover→touch/gyro),
   tier di qualità per breakpoint, budget per device. Il perf-fallback-auditor resta il gate
   read-only S7; questo agente progetta a monte ciò che l'auditor verificherà a valle.
   Trigger IT: "mobile", "stesso impatto sul telefono", "parità", "su tutti i dispositivi".

**Nuove skill** (in `.claude/skills/`):
- `taste-lug-2026` — il gusto codificato: pattern dominanti, segnali "non banale", anti-pattern
  vietati (hero statico, palette grigio-safe, motion decorativo senza narrativa, 3D
  showpiece scollegato dal contenuto), con processo di refresh trimestrale via recon.
- `brand-to-3d` — il cookbook dei 3 trattamenti logo con parametri e gotcha (fill-rule,
  path malformati, bevel su path complessi, budget particelle mobile).
- `client-intake` v2 — la skill esistente estesa con i 3 flussi S0a/S0b/S0c.

**Auto-trigger globale** — `~/.claude/hooks/web3d-autostart.py` (pattern degli altri
autostart): si attiva su (crea|migliora|sistema|rifai|redesign).*(sito|website|landing|web
app|homepage) o su "sito 3D"; inietta root del kit, regola worktree, pipeline S0-S7 e la
mappa agenti. Anti-falsi-positivi: richiede sostantivo-sito + verbo d'azione nella stessa
frase; cede la precedenza se vault-brain ha già rilevato un progetto-sito specifico
(es. Laribinto) indicandone la scheda; mai attivarsi su "sito" in senso generico
("sul sito di Supabase…").

## D. Sequenza operativa

1. **Fase 1 (subito)**: meta-layer (4 agenti + 2 skill + intake v2 + hook globale) +
   template blueprint + code-split. Sblocca tutto il resto.
2. **Fase 2**: blueprint 04, 07-12 col QA loop; gate S7 verde (<300KB gz).
3. **Fase 3**: le 3 porte S0 (script site-autopsy + extract-brand + flussi skill) e prova
   end-to-end su un caso reale (candidato: redesign di un sito esistente di Lorenzo, modalità B).
4. **Fase 4**: blueprint 13-18 ricerca-driven a trascinamento di progetti veri (il registro
   cresce quando un cliente lo giustifica — regola già in vigore).

## Fonti principali (ricerca 10 lug 2026)

- WebGPU: [webgpu.com — critical mass](https://www.webgpu.com/news/webgpu-hits-critical-mass-all-major-browsers/), [appdevelopermagazine — WebGPU in iOS 26](https://appdevelopermagazine.com/webgpu-in-ios-26/), [byteiota — 70% support](https://byteiota.com/webgpu-2026-70-browser-support-15x-performance-gains/)
- Splats: [utsubo — Gaussian Splatting guide 2026](https://www.utsubo.com/blog/gaussian-splatting-guide), [thefuture3d — state of GS 2026](https://www.thefuture3d.com/blog/state-of-gaussian-splatting-2026/), [swyvl — best viewers](https://swyvl.io/blog/best-gaussian-splat-viewers/)
- GSAP/Motion: [webflow — GSAP free](https://webflow.com/updates/gsap-becomes-free), [Codrops — free GSAP plugins demos](https://tympanus.net/codrops/2025/05/14/from-splittext-to-morphsvg-5-creative-demos-using-free-gsap-plugins/)
- View Transitions: [MDN](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API), [trade-assistance — cross-document 2026](https://trade-assistance.com/blog/cross-document-view-transitions-mpa-2026/)
- Trend: [Figma web design trends 2026](https://www.figma.com/resource-library/web-design-trends/), [envato — kinetic type & broken grids](https://elements.envato.com/learn/web-design-trends), [wix — 11 trends 2026](https://www.wix.com/blog/web-design-trends), [topcssgallery — award galleries 2026](https://www.topcssgallery.com/blog/web-design-trends-dominating-award-galleries/)
- Interazioni: [Codrops — Podium case study](https://tympanus.net/codrops/2026/06/23/podium-building-a-website-where-running-becomes-storytelling/), [futurists — award winners 2026](https://futurists.in/10-best-award-winning-websites-of-2026/)
- TSL/compute: [Maxime Heckel — Field guide to TSL](https://blog.maximeheckel.com/posts/field-guide-to-tsl-and-webgpu/), [threejs-blocks — Boids WebGPU](https://www.threejs-blocks.com/docs/Boids), [Wawa Sensei — GPGPU TSL](https://wawasensei.dev/courses/react-three-fiber/lessons/tsl-gpgpu), [Wawa Sensei — fake godrays](https://wawasensei.dev/tuto/how-to-build-godrays), [three.js — volumetric lighting WebGPU](https://threejs.org/examples/webgpu_volume_lighting.html)
- Img-to-site: [banani — AI design-to-code 2026](https://www.banani.co/blog/ai-design-to-code-tools), [dembrandt (GitHub)](https://github.com/dembrandt/dembrandt), [miromiro — screenshot-to-code 2026](https://miromiro.app/blog/screenshot-to-code-what-actually-works), [abi/screenshot-to-code](https://github.com/abi/screenshot-to-code)
- Gamification: [Awwwards — gamified web experience](https://www.awwwards.com/inspiration/a-gamified-web-experience), [utsubo — game studio sites 2026](https://www.utsubo.com/blog/game-studio-immersive-website-guide)
- Logo→3D: [threejsresources — SVG to 3D](https://threejsresources.com/3d-logo-generator), [svgator — animated logo examples](https://www.svgator.com/blog/animated-logo-examples/)

# Deep dive: stack e librerie di asset del Web3D Kit

Data: 9 luglio 2026
Estende: dossier e playbook già in repo. Questo file scende al livello di API, comandi e licenze. Va anch'esso in `docs/` e diventa materiale sorgente per le skill del kit. Nota per Claude Code: i frammenti di codice sono pattern di riferimento verificati sulla documentazione 2026, ma prima di usarli controlla sempre le firme esatte contro le versioni installate nel repo.

---

# PARTE I. Lo stack, strato per strato

## 1. Rendering: three/webgpu + TSL

**Import e renderer.** Il kit importa da `three/webgpu` (classi, renderer, materiali Node) e da `three/tsl` (funzioni shader). WebGPURenderer richiede init asincrona; R3F v9 lo supporta con la prop `gl` che restituisce una Promise. Il renderer ricade da solo su WebGL quando WebGPU manca, e con `forceWebGL: true` puoi forzare il fallback per collaudarlo, cosa che il visual-qa-operator deve fare a ogni progetto.

```tsx
'use client'
import * as THREE from 'three/webgpu'
import { Canvas, extend, type ThreeToJSXElements } from '@react-three/fiber'

declare module '@react-three/fiber' {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}
extend(THREE as any)

export function GLCanvas({ children }: { children: React.ReactNode }) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={async (props) => {
        const renderer = new THREE.WebGPURenderer(props as any)
        await renderer.init()
        return renderer
      }}
    >
      {children}
    </Canvas>
  )
}
```

**TSL, il cuore del vantaggio.** TSL è il sistema a nodi di Three: shader scritti come composizione di funzioni JavaScript che compilano in WGSL su WebGPU e in GLSL su WebGL. Un solo codice, due backend, zero doppia manutenzione. I punti di aggancio sono le proprietà node dei materiali (`colorNode`, `positionNode`, `emissiveNode`, `opacityNode`), i costruttori (`uniform`, `Fn`, `vec2/3/4`, `float`), gli input di scena (`uv`, `time`, `positionWorld`, `normalWorld`) e le librerie di rumore MaterialX incluse (`mx_noise_float`, `mx_fractal_noise_float`). Schema del mesh gradient di sezione 2 di ORYZO:

```ts
import * as THREE from 'three/webgpu'
import { Fn, uniform, uv, vec3, mix, time, mx_noise_float } from 'three/tsl'

export const gradientUniforms = {
  colorA: uniform(new THREE.Color('#0b0b10')),
  colorB: uniform(new THREE.Color('#7c5cff')),
  colorC: uniform(new THREE.Color('#ff7ad9')),
  flow: uniform(0.15),          // velocità
  pointer: uniform(new THREE.Vector2()), // deformazione dal mouse
}

export function makeGradientMaterial() {
  const m = new THREE.MeshBasicNodeMaterial()
  m.colorNode = Fn(() => {
    const p = uv().mul(3.0).add(gradientUniforms.pointer.mul(0.4))
    const n1 = mx_noise_float(vec3(p, time.mul(gradientUniforms.flow)))
    const n2 = mx_noise_float(vec3(p.mul(2.0), time.mul(gradientUniforms.flow).add(7.0)))
    const base = mix(gradientUniforms.colorA, gradientUniforms.colorB, n1.mul(0.5).add(0.5))
    return mix(base, gradientUniforms.colorC, n2.mul(0.25).add(0.25))
  })()
  return m
}
```

I parametri esposti come `uniform` sono la chiave del registro: lo stesso materiale serve dieci clienti cambiando i token colore da `direction.md`. Per i sistemi particellari pesanti TSL offre anche i compute shader (`instancedArray` più una funzione compute): posizioni e fisica calcolate su GPU, utile per hero con decine di migliaia di istanze, ma è tier alto di performance e va dietro il gate del perf-fallback-auditor.

**drei: cosa usare e cosa evitare.** I moduli che il genere usa davvero: `useGLTF` (carica GLB con Draco/Meshopt), `useKTX2`/`useTexture`, `Environment` e `Lightformer` (illuminazione IBL, vedi §8), `Float` (idle elegante degli oggetti hero), `Html` (etichette DOM ancorate alla scena), `View` (più viewport nello stesso canvas: è la tecnica giusta per l'oggetto "in bounding box" della sezione 3, senza pagare un secondo contesto WebGL), `Preload`, `AdaptiveDpr`, `PerformanceMonitor`, `Center`, `Bounds`. Da evitare nel nostro genere: `ScrollControls` di drei, che possiede lo scroll e confligge con Lenis+ScrollTrigger; lo scroll lo governa GSAP, la scena lo subisce (§3). Attenzione anche ai preset di `Environment`, che scaricano HDRI da CDN esterna: in produzione si usano sempre file locali.

**Post-processing.** Due strade. Sul percorso TSL nativo, `THREE.PostProcessing` con output node componibile (bloom, grana, vignetta scritti in TSL); in R3F il pattern è renderizzare il post dentro un `useFrame` con `renderPriority` a 1, che disattiva il render automatico e garantisce l'ordine. In alternativa, sul pavimento WebGL, pmndrs/postprocessing con `EffectComposer` di drei resta la via più matura. Regola del kit: grana e vignetta quasi gratis, bloom con parsimonia, niente catena di effetti su mobile.

**Colore e tono.** Tone mapping ACESFilmic, `outputColorSpace` sRGB. In R3F v9 è cambiata la gestione sRGB delle texture passate come prop: le texture colore dei materiali builtin sono gestite in automatico, ma su materiali custom va dichiarato `texture.colorSpace = THREE.SRGBColorSpace`, altrimenti le normal map si corrompono o i colori slavano. È una delle prime cose che il QA visivo impara a riconoscere.

## 2. Motion: GSAP 3.13+ e Lenis

**Il ponte canonico.** Un solo requestAnimationFrame per tutto il sito, quello di GSAP; Lenis ci si aggancia e notifica ScrollTrigger:

```ts
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

gsap.registerPlugin(ScrollTrigger)

export const lenis = new Lenis({ lerp: 0.1 })
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((t) => lenis.raf(t * 1000))
gsap.ticker.lagSmoothing(0)
```

Non combinare `ScrollTrigger.normalizeScroll()` con Lenis: fanno lo stesso lavoro e si pestano. In React ogni animazione vive dentro `useGSAP` di `@gsap/react` con `scope`: al dismount fa il revert del contesto e uccide i trigger, che è il 90 per cento dei bug di navigazione in App Router.

**ScrollTrigger, i pattern del genere.** La sezione pinnata con timeline scrubbed è il mattone base:

```ts
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: sectionRef.current,
    start: 'top top',
    end: '+=250%',        // durata in altezza viewport
    pin: true,
    scrub: true,
    invalidateOnRefresh: true,
  },
})
```

Accorgimenti obbligatori: `gsap.matchMedia()` per varianti responsive e per `(prefers-reduced-motion: reduce)`, dove lo scrub si sostituisce con stati statici; `ScrollTrigger.refresh()` dopo `document.fonts.ready` e dopo il caricamento delle immagini, altrimenti start ed end sono calcolati su layout sbagliati; il pin genera un pin-spacer, quindi le altezze vanno riservate per non produrre CLS; su cambio route, kill di tutti i trigger prima del mount della pagina nuova.

**SplitText, versione 2025.** La riscrittura uscita con la liberalizzazione ha tre novità che cambiano il modo di scrivere la tipografia cinetica: il masking integrato (`mask: 'lines'`, niente più wrapper overflow hidden fatti a mano), l'`autoSplit` che ri-splitta da solo al resize e al caricamento font con callback `onSplit` per ricostruire l'animazione, e l'accessibilità gestita (aria sul contenitore, caratteri nascosti agli screen reader). ScrambleText copre il bottone "decode" della sezione 6 in tre righe. Flip serve per le transizioni di layout della gallery.

**Il camera director.** Per la scena persistente che si trasforma, il pattern robusto è una progress map per sezione più un'unica regia camera. Ogni sezione scrive il proprio progresso 0→1, la regia lo consuma:

```ts
// lato DOM (scroll-motion-engineer)
ScrollTrigger.create({
  trigger: el, start: 'top bottom', end: 'bottom top', scrub: true,
  onUpdate: (self) => useSiteStore.getState().setProgress('hero', self.progress),
})

// lato scena (r3f-scene-architect)
useFrame(() => {
  const p = useSiteStore.getState().progress.hero ?? 0
  camera.position.lerpVectors(camA, camB, ease(p))
  gradientUniforms.flow.value = 0.1 + p * 0.2
})
```

Per percorsi camera complessi: `CatmullRomCurve3` campionata dal progresso. Lo store è zustand letto imperativamente in `useFrame`: mai stato React aggiornato a 60fps.

**Transizioni di pagina.** In App Router la via 2026 è la View Transitions API (pacchetto next-view-transitions o supporto nativo del framework) per il crossfade DOM, più un sipario proprietario per coprire lo swap della scena WebGL. Barba.js resta valido solo fuori da React.

## 3. Framework, token e tipografia

**Next.** La scena è client-only: `dynamic(() => import('@/webgl/Scene'), { ssr: false })`. Il server component della pagina renderizza subito il poster della hero (immagine ottimizzata, priority): è lui il candidato LCP, non il canvas. Font self-hosted via `next/font/local` con `display: 'swap'` e preload dei due pesi display.

**Token: una sola fonte di verità.** `direction.md` viene compilato da uno script in `design-tokens.json`, da cui nascono sia il tema Tailwind v4 (blocco `@theme` con variabili CSS: colori, font, scala spazi) sia le uniform iniziali dei materiali TSL. Così DOM e canvas non possono divergere, e il creative-director cambia il gradiente di tutto il sito toccando un file.

**Scala tipografica fluida.** Il display gigante del genere si fa con clamp: `font-size: clamp(2.8rem, 1rem + 9vw, 11rem)` per la headline, eyebrow monospace fisso a 0.75-0.8rem con tracking largo e maiuscoletto. Leading stretto sul display (0.9-1.0), `text-wrap: balance` sulle headline, `font-variant-numeric: tabular-nums` su counter e footnote tecniche.

---

# PARTE II. La pipeline asset in dettaglio

## 4. Geometria: Draco contro Meshopt

| | Draco | Meshopt (EXT_meshopt_compression) |
|---|---|---|
| Rapporto compressione | Massimo su geometria statica | Vicino a Draco una volta servito con gzip/brotli |
| Velocità di decodifica | Lenta, WASM pesante | Molto rapida, decoder minuscolo |
| Animazioni e morph | Non comprime le animazioni | Comprime anche animazioni e morph target |
| Verdetto kit | Solo per geometrie statiche enormi | Default del kit |

Ricette gltf-transform, quelle che `scripts/optimize-assets.mjs` incapsula:

```bash
npx @gltf-transform/cli inspect model.glb                 # diagnosi: pesi, materiali, draw call
npx @gltf-transform/cli optimize in.glb out.glb \
  --compress meshopt --texture-compress ktx2 \
  --texture-size 2048                                     # il colpo unico: weld, prune, quantize, resize
```

Per il controllo fine, i passaggi singoli utili: `weld` (salda vertici duplicati), `prune` (rimuove nodi e materiali orfani), `palette` (fonde materiali a tinta unita in una micro-texture, crolla il numero di draw call), `resample` (alleggerisce le tracce di animazione), `resize`. Budget del kit: modello hero 100-150k triangoli su desktop, la metà su mobile; secondari sotto i 50k; il totale GLB della pagina sotto i 5 MB già compressi.

## 5. Texture: KTX2, ETC1S contro UASTC

KTX2/Basis è l'unico formato che resta compresso anche in VRAM, quindi taglia sia la rete sia la memoria GPU, che su mobile è il vero collo di bottiglia. Due modalità: **ETC1S** per albedo e mappe dove piccole imperfezioni cromatiche non si vedono (file minuscoli), **UASTC** per normal map, roughness/metalness e tutto ciò che genera artefatti visibili (più pesante, qualità alta). Lato loader: `KTX2Loader` con `setTranscoderPath` puntato ai transcoder Basis copiati in `/public/basis/`, collegato al GLTFLoader; drei espone `useKTX2` per le texture sciolte. Regola pratica: 2048 al massimo per l'hero, 1024 per il resto, mipmap sempre.

## 6. Blender in batch

Quando l'asset arriva grezzo (acquistato, scansionato o generato), la normalizzazione non si fa a mano: Blender gira headless dentro la pipeline dell'asset-wrangler.

```bash
blender --background --python scripts/blender/prep.py -- \
  --input raw/coaster.fbx --out staged/coaster.glb --target-tris 120000
```

Lo script tipo fa, in ordine: import, applica trasformazioni e scala reale, Decimate o remesh al budget di triangoli, smart UV se mancano, bake dell'ambient occlusion in una mappa dedicata (l'AO baked è metà dell'aspetto "premium" a costo runtime zero), export GLB. Il bake della luce completa (lightmap) si usa solo su scene statiche; nel nostro genere di solito basta AO + Environment.

## 7. HDRI e illuminazione

L'illuminazione del genere è quasi sempre IBL pura: un HDRI in `Environment`, niente selve di luci dinamiche. Tre regole. Primo: 1k di risoluzione basta per la sola illuminazione (il PMREM la prefiltra comunque), 2k solo se l'HDRI è visibile come sfondo. Secondo: file locali in `/public/hdri/`, mai i preset che pescano da CDN. Terzo: per il look "studio product" alla ORYZO spesso si abbandona l'HDRI fotografico e si compone l'ambiente con `Lightformer` dentro `<Environment resolution={256}>`: pannelli luminosi sintetici, controllo totale dei riflessi sul prodotto, peso irrisorio.

## 8. Immagini, poster e video

Fotografie della gallery: pipeline sharp in `scripts/` che genera AVIF più fallback WebP a 3 larghezze, servite con `next/image`. Il poster di ogni scena 3D (fallback mobile e LCP) si genera dalla scena stessa: uno script Playwright apre la pagina in headless, aspetta il primo frame renderizzato e salva lo screenshot che diventa l'immagine statica. Così poster e scena non divergono mai. Trattamenti tipo FLIR o il tuo noir milanese restano nella tua pipeline Python esistente e confluiscono in `/public/assets` come qualsiasi altro asset.

## 9. Budget, tiering e smaltimento

**La scala di degrado**, decisa una volta al load con detect-gpu (pmndrs) e `prefers-reduced-motion`:

```ts
import { getGPUTier } from 'detect-gpu'
const { tier } = await getGPUTier()   // 0..3
// tier 3: scena piena + post   | tier 2: scena piena, post ridotto
// tier 1: dpr 1.25, niente post, particelle dimezzate
// tier 0 o reduced-motion: poster statici, animazioni DOM essenziali
```

A runtime, `PerformanceMonitor` di drei declassa il DPR se il framerate scende: la qualità si adatta, il sito non scatta mai. **Smaltimento**: ogni sezione custom deve fare dispose di geometrie, materiali e texture al dismount e kill dei propri ScrollTrigger; `useGLTF` cachea, quindi il preload va fatto (`useGLTF.preload`) e la cache svuotata solo tra route pesanti. **Core Web Vitals nel nostro genere**: LCP lo vince il poster server-rendered; il CLS lo minacciano i pin-spacer (riservare le altezze) e i font (swap + metriche compatibili); l'INP lo minacciano i long task di parsing GLB, che si spezzano caricando i modelli dopo il first paint e fuori dal main thread quando possibile (Meshopt aiuta proprio qui).

---

# PARTE III. Le librerie di asset, con le licenze

Il criterio, prima dell'elenco: in un repo cliente entrano solo asset CC0, asset con licenza commerciale acquistata, asset generati con licenza privata, o asset tuoi. Il CC-BY è ammesso con attribuzione tracciata in un `CREDITS.md`. Tutto passa dal manifest della §12.

## 10. Modelli 3D pronti

| Fonte | Licenza | Per cosa | Note |
|---|---|---|---|
| Poly Haven | CC0 | Modelli, texture, HDRI di qualità costante | La base del kit, uso commerciale senza attribuzione |
| pmndrs Market (market.pmnd.rs) | CC0 | Asset curati per l'ecosistema R3F | Già pensati per il web |
| Quaternius, Kenney | CC0 | Low poly stilizzato | Perfetti per prototipi e storyboard |
| ambientCG | CC0 | Materiali PBR, decal | Vedi §11 |
| Sketchfab (filtro download) | CC misto | Varietà enorme | Filtrare CC0/CC-BY, escludere NC, attribuire i BY |
| Fab (Epic) | Standard/CC per voce | Hero asset fotorealistici, Megascans | L'era dei Megascans gratis per tutti è finita: oggi il grosso è a pagamento fuori da Unreal, con uno starter pack libero di circa 1.500 asset e le voci gratuite mensili. Controllare la licenza voce per voce |
| TurboSquid, CGTrader, KitBash3D | Royalty free a pagamento | Prodotti hero specifici | Verificare che la licenza copra il web interattivo |

Vietato sempre: modelli estratti da videogiochi, scansioni di prodotti di marchi reali usate come prodotto (il "prodotto inventato" alla ORYZO esiste proprio per aggirare l'IP), asset "free" senza licenza dichiarata.

## 11. La corsia generativa (la tua arma per i mockup)

Per il genere ORYZO, dove il prodotto è fittizio e satirico, la generazione AI image-to-3D è la corsia più veloce: prompt o render 2D del prodotto inventato, poi mesh. Stato 2026 e regole d'uso:

- **Meshy 6**: la piattaforma più completa (testo/immagine → 3D, retexturing, rigging, export GLB/FBX/OBJ/BLEND, plugin Blender). Attenzione alla licenza: il piano gratuito rilascia i modelli in CC BY 4.0, quindi commerciale sì ma con attribuzione; dai piani a pagamento in su c'è la licenza privata senza attribuzione. Per lavoro cliente: piano a pagamento, sempre.
- **Tripo 3.1**: topologia più pulita della categoria (Smart Mesh genera low poly a quad con edge flow sensato), il che riduce il lavoro di retopologia. Ha una REST API asincrona (submit → task id → polling) che è il candidato naturale per automatizzare l'asset-wrangler: la generazione entra nella pipeline come un comando. Uso commerciale sui piani a pagamento.
- **Rodin (Hyper3D)**: texture più fotorealistiche, mesh meno pulite; per hero asset da rifinire.
- **TRELLIS-2 e Hunyuan3D**: open source (TRELLIS-2 in MIT), girano in locale se vuoi azzerare i costi variabili e le questioni di licenza; qualità sotto i commerciali ma in crescita rapida.

Il workflow del kit, qualunque sia il generatore: genera → `inspect` con gltf-transform → passaggio Blender headless (§6) per remesh al budget, UV e bake AO → `optimize` → registro. Un modello generato non entra mai in scena grezzo: la topologia AI non regge deformazioni e spesso sfora i budget di un ordine di grandezza.

## 12. HDRI, texture, materiali

Poly Haven per gli HDRI (categorie studio e outdoor coprono il 95 per cento dei casi del genere); ambientCG per PBR e decal, tutto CC0. Per il look product-shot, come detto, spesso conviene l'ambiente sintetico a Lightformer e nessun HDRI. I matcap (la scorciatoia per oggetti lucidi senza costo di lighting) hanno grandi raccolte pubbliche su GitHub: utili, ma la licenza va verificata raccolta per raccolta prima di un lavoro cliente. Per i pattern procedurali in TSL esistono raccolte open di materiali già scritti a nodi (ad esempio il progetto tsl-textures): ottime da studiare e adattare, controllando la licenza del repo.

## 13. Tipografia

Il genere vive di display type, e qui la scelta della fonte è metà dell'art direction. Fasce:

- **Gratuite con uso commerciale pieno, da self-hostare**: Fontshare (fonderia ITF: Clash Display, General Sans, Cabinet Grotesk, Satoshi; licenza gratuita anche commerciale, vietata la ridistribuzione della fonte in sé); Uncut.wtf come aggregatore di typeface open source, in gran parte SIL OFL; su Google Fonts le variabili utili al genere: Space Grotesk, Instrument Serif per il contrasto editoriale, Inter per il testo.
- **Monospace per gli eyebrow**: JetBrains Mono, IBM Plex Mono, Space Mono, tutte libere.
- **Gli standard "veri" del genere, a pagamento**: PP Neue Montreal (Pangram Pangram: i pesi di prova non coprono l'uso commerciale), Suisse Int'l, Neue Haas Grotesk, ABC Diatype. Da preventivare quando il cliente vuole il look esatto delle reference Awwwards.

Regola tecnica: sempre self-host via `next/font/local`, mai CDN di terzi (performance e GDPR), subsetting dei glifi se il file supera i 100 KB per peso, massimo due famiglie più una mono per progetto.

## 14. Codice di riferimento e componenti

- **Codrops**: la miniera storica delle tecniche del genere, ogni tutorial ha il repo. La licenza tipo permette il riuso anche commerciale nei progetti ma vieta la rivendita del demo così com'è: va comunque letta nel singolo repo. Metodo del kit: da Codrops si estrae la tecnica e la si riscrive come blueprint con i nostri token, mai copia diretta.
- **Ecosistema pmndrs**: oltre a drei e postprocessing, tieni nel raggio maath (easing, damping, distribuzioni random per particellari), three-mesh-bvh (raycast veloce su mesh dense, serve al pointer-rig), leva e r3f-perf come strumenti di sviluppo da escludere dalla build.
- **React Bits**: resta il tuo catalogo per il layer DOM (testi animati, card, cursori); nel registro i suoi pezzi coprono gli slot non-3D dei blueprint.
- **Shader di riferimento, attenzione alle licenze**: Shadertoy ha come default CC BY-NC-SA, quindi niente lavoro cliente salvo licenza diversa dichiarata dall'autore; la libreria Lygia richiede una licenza commerciale o la sponsorizzazione per uso commerciale, da verificare prima di importarne funzioni; The Book of Shaders è materiale di studio. La fonte più sicura e più aggiornata per il TSL sono gli esempi ufficiali di three.js (`examples/webgpu_*`), licenza MIT: è lì che il tsl-shader-engineer va a scavare per primo.

## 15. Il manifest delle sorgenti (per l'asset-wrangler)

Da aggiungere al repo come `registry/approved-sources.json`; l'asset-wrangler può attingere solo da qui, e ogni asset in `assets-manifest.json` deve citare sorgente e classe di licenza:

```json
{
  "cc0": ["polyhaven.com", "market.pmnd.rs", "ambientcg.com", "quaternius.com", "kenney.nl"],
  "generative_paid": ["meshy.ai (licenza privata, piano a pagamento)", "tripo3d.ai (piano a pagamento)"],
  "paid_per_item": ["fab.com", "turbosquid.com", "cgtrader.com"],
  "cc_by": { "policy": "ammesso con riga in CREDITS.md", "esempi": ["sketchfab (filtro CC-BY)"] },
  "vietato": ["shadertoy default", "rip da giochi", "modelli di prodotti reali di marchi terzi", "free tier generativi senza licenza commerciale"]
}
```

---

## Cosa cambia nel playbook dopo questo deep dive

Tre ritocchi da applicare: la skill tsl-gradient-cookbook assorbe la §1 (uniform esposte, mx_noise, pattern PostProcessing) e la regola "prima gli esempi webgpu_* di three.js"; l'asset-wrangler guadagna la corsia generativa della §11 con l'API Tripo come comando di pipeline e il vincolo del manifest §15; il perf-fallback-auditor adotta la scala di degrado a tier della §9 come tabella di gate. Il prompt di bootstrap resta valido: aggiungi solo, in FASE 1, la creazione di `registry/approved-sources.json` e dei transcoder Basis in `/public/basis/`.

import { lazy, Suspense } from 'react'
import { SmoothScroll } from './scroll/SmoothScroll'
import { Poster } from './canvas/Poster'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useQualityTier } from './hooks/useQualityTier'
import { supportsWebGL } from './lib/webgl'
import { QaScrollBridge } from './qa/QaScrollBridge'
import { qaEnabled } from './qa/bridge'
// Composizione dal registro (regola d'oro, piano in brief/composition-plan.md):
import { PreloaderProgress } from '../registry/01-preloader-progress/PreloaderProgress'
import { Hero3dSplit } from '../registry/02-hero-3d-split/Hero3dSplit'
import { MeshGradientField } from '../registry/03-mesh-gradient-field/MeshGradientField'
import { PinnedSceneScrub } from '../registry/05-pinned-scene-scrub/PinnedSceneScrub'
import { ProductExplode } from '../registry/13-product-explode/ProductExplode'
import { TypeBehindProduct } from '../registry/14-type-behind-product/TypeBehindProduct'
import { ProductGallery } from '../registry/15-product-gallery/ProductGallery'
import { SpecSheetLatex } from '../registry/08-spec-sheet-latex/SpecSheetLatex'
import { EditorialGallery } from '../registry/07-editorial-gallery/EditorialGallery'
import { HorizontalScrollStrip } from '../registry/11-horizontal-scroll-strip/HorizontalScrollStrip'
import { DisplayStatement } from '../registry/10-display-statement/DisplayStatement'
import { InteractionCard } from '../registry/09-interaction-card/InteractionCard'
import { KineticType } from '../registry/06-kinetic-type/KineticType'
import { PointerRig3d } from '../registry/04-pointer-rig-3d/PointerRig3d'
import { FooterCta } from '../registry/12-footer-cta/FooterCta'
// Copy: S3, uno slot-file per sezione (content/README.md)
import heroCopy from '../content/01-hero.json'
import gradientCopy from '../content/03-gradient.json'
import scrubCopy from '../content/05-scrub.json'
import explodeCopy from '../content/13-explode.json'
import veilCopy from '../content/14-veil.json'
import prodGalleryCopy from '../content/15-gallery.json'
import specCopy from '../content/08-spec.json'
import galleryCopy from '../content/07-gallery.json'
import stripCopy from '../content/11-strip.json'
import statementCopy from '../content/10-statement.json'
import cardCopy from '../content/09-card.json'
import kineticCopy from '../content/06-kinetic.json'
import pointerCopy from '../content/04-pointer.json'
import footerCopy from '../content/12-footer.json'
// Asset scontornati: manifesto generato da npm run cutouts:encode (importato, non fetchato —
// ScrollTrigger misura la sezione al mount)
import { cutouts } from './lib/cutouts.generated'

// Il layer 3D entra da un import DINAMICO: è ciò che tiene three/webgpu, R3F e drei fuori dal
// grafo statico dell'entry. Con un import statico il chunk `three` finisce in <link modulepreload>
// e il code-split diventa cosmetico (misurato: 599 KB gzip comunque sul primo paint).
// Il preloader nel frattempo mostra il progresso pubblicato su src/lib/loadProgress.ts.
const CanvasLayer = lazy(() => import('./canvas/CanvasLayer'))
// Il laboratorio delle discipline di realismo (?lab=1): stesso confine lazy — il chunk del lab
// (rapier compreso) esiste solo per chi apre il lab, l'entry non lo preannuncia.
const RealismLab = lazy(() => import('./lab/RealismLab'))
const labRequested = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('lab')

export default function App() {
  const reduced = useReducedMotion()
  const { tier, detail, amplitude, dpr } = useQualityTier()
  const webglOk = supportsWebGL()

  if (labRequested && webglOk) {
    return (
      <Suspense fallback={<Poster />}>
        <RealismLab />
      </Suspense>
    )
  }

  return (
    <SmoothScroll>
      {/* metà "DOM" del ponte QA — deve stare QUI dentro: il <Canvas> è una reconciler root
          separata e il context di Lenis non lo attraversa. Montata solo con ?qa=1. */}
      {qaEnabled() && <QaScrollBridge />}
      <PreloaderProgress minShowMs={600} reduced={reduced} expectsCanvas={webglOk} />

      {/* fixed full-screen 3D layer, decorative for assistive tech — UNA scena persistente */}
      <div className="canvas-layer" aria-hidden="true">
        {webglOk ? (
          <Suspense fallback={<Poster />}>
            <CanvasLayer
              reduced={reduced}
              detail={detail}
              amplitude={amplitude}
              flowScale={tier === 'low' ? 0.5 : 1}
              dpr={dpr}
            />
          </Suspense>
        ) : (
          <Poster />
        )}
      </div>

      {/* scrollable DOM content above the canvas: i blueprint scrivono la progress map,
          il CameraDirector dirige la scena (brief/storyboard.md è la sceneggiatura).
          Ordine di pagina = ordine del testimone in CameraDirector e in progressMap. */}
      <main className="content">
        <Hero3dSplit copy={heroCopy} reduced={reduced} />
        <MeshGradientField copy={gradientCopy} reduced={reduced} />
        <PinnedSceneScrub copy={scrubCopy} reduced={reduced} />
        {/* capitoli «prodotto a strati»: il protagonista è il DOM, la scena si fa da parte */}
        <ProductExplode copy={explodeCopy} product={cutouts.products.stack} reduced={reduced} />
        <TypeBehindProduct copy={veilCopy} product={cutouts.products.stack} reduced={reduced} />
        <ProductGallery copy={prodGalleryCopy} product={cutouts.products.stack} reduced={reduced} />
        {/* la scheda tecnica SIEDE nel blocco quiete del prodotto: eredita il segnale e */}
        <SpecSheetLatex copy={specCopy} reduced={reduced} />
        {/* blocco editoriale: la scena riprende voce capitolo per capitolo */}
        <EditorialGallery copy={galleryCopy} reduced={reduced} />
        <HorizontalScrollStrip copy={stripCopy} reduced={reduced} />
        <DisplayStatement copy={statementCopy} reduced={reduced} />
        <InteractionCard copy={cardCopy} reduced={reduced} />
        {/* blueprint 04: la meta' DOM del pointer-rig; il satellite vive in CanvasLayer */}
        <PointerRig3d copy={pointerCopy} reduced={reduced} />
        <KineticType copy={kineticCopy} reduced={reduced} />
        <FooterCta copy={footerCopy} reduced={reduced} />
      </main>
    </SmoothScroll>
  )
}

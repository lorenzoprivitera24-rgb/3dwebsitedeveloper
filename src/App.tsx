import { lazy, Suspense } from 'react'
import { SmoothScroll } from './scroll/SmoothScroll'
import { Poster } from './canvas/Poster'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useQualityTier } from './hooks/useQualityTier'
import { supportsWebGL } from './lib/webgl'
// Composizione dal registro (regola d'oro, piano in brief/composition-plan.md):
import { PreloaderProgress } from '../registry/01-preloader-progress/PreloaderProgress'
import { Hero3dSplit } from '../registry/02-hero-3d-split/Hero3dSplit'
import { MeshGradientField } from '../registry/03-mesh-gradient-field/MeshGradientField'
import { PinnedSceneScrub } from '../registry/05-pinned-scene-scrub/PinnedSceneScrub'
import { EditorialGallery } from '../registry/07-editorial-gallery/EditorialGallery'
import { HorizontalScrollStrip } from '../registry/11-horizontal-scroll-strip/HorizontalScrollStrip'
import { InteractionCard } from '../registry/09-interaction-card/InteractionCard'
import { KineticType } from '../registry/06-kinetic-type/KineticType'
import { FooterCta } from '../registry/12-footer-cta/FooterCta'
// Copy: S3, uno slot-file per sezione (content/README.md)
import heroCopy from '../content/01-hero.json'
import gradientCopy from '../content/03-gradient.json'
import scrubCopy from '../content/05-scrub.json'
import galleryCopy from '../content/07-gallery.json'
import stripCopy from '../content/11-strip.json'
import cardCopy from '../content/09-card.json'
import kineticCopy from '../content/06-kinetic.json'
import footerCopy from '../content/12-footer.json'

// Il layer 3D entra da un import DINAMICO: è ciò che tiene three/webgpu, R3F e drei fuori dal
// grafo statico dell'entry. Con un import statico il chunk `three` finisce in <link modulepreload>
// e il code-split diventa cosmetico (misurato: 599 KB gzip comunque sul primo paint).
// Il preloader nel frattempo mostra il progresso pubblicato su src/lib/loadProgress.ts.
const CanvasLayer = lazy(() => import('./canvas/CanvasLayer'))

export default function App() {
  const reduced = useReducedMotion()
  const { tier, detail, amplitude, dpr } = useQualityTier()
  const webglOk = supportsWebGL()

  return (
    <SmoothScroll>
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
          il CameraDirector dirige la scena (brief/storyboard.md è la sceneggiatura) */}
      <main className="content">
        <Hero3dSplit copy={heroCopy} reduced={reduced} />
        <MeshGradientField copy={gradientCopy} reduced={reduced} />
        <PinnedSceneScrub copy={scrubCopy} reduced={reduced} />
        <EditorialGallery copy={galleryCopy} reduced={reduced} />
        <HorizontalScrollStrip copy={stripCopy} reduced={reduced} />
        <InteractionCard copy={cardCopy} reduced={reduced} />
        <KineticType copy={kineticCopy} reduced={reduced} />
        <FooterCta copy={footerCopy} reduced={reduced} />
      </main>
    </SmoothScroll>
  )
}

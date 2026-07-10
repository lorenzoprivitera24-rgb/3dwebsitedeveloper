import { SmoothScroll } from './scroll/SmoothScroll'
import { Stage } from './canvas/Stage'
import { Scene } from './canvas/Scene'
import { Poster } from './canvas/Poster'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useQualityTier } from './hooks/useQualityTier'
import { supportsWebGL } from './lib/webgl'
// Composizione dal registro (regola d'oro, piano in brief/composition-plan.md):
import { PreloaderProgress } from '../registry/01-preloader-progress/PreloaderProgress'
import { Hero3dSplit } from '../registry/02-hero-3d-split/Hero3dSplit'
import { MeshGradientField } from '../registry/03-mesh-gradient-field/MeshGradientField'
import { PinnedSceneScrub } from '../registry/05-pinned-scene-scrub/PinnedSceneScrub'
import { KineticType } from '../registry/06-kinetic-type/KineticType'
import { PointerRig3d } from '../registry/04-pointer-rig-3d/PointerRig3d'
import { RigSatellite } from '../registry/04-pointer-rig-3d/RigSatellite'
// Copy: S3, uno slot-file per sezione (content/README.md)
import heroCopy from '../content/01-hero.json'
import gradientCopy from '../content/03-gradient.json'
import scrubCopy from '../content/05-scrub.json'
import kineticCopy from '../content/06-kinetic.json'
import pointerCopy from '../content/04-pointer.json'
import outroCopy from '../content/07-outro.json'

export default function App() {
  const reduced = useReducedMotion()
  const { tier, detail, amplitude, dpr } = useQualityTier()
  const webglOk = supportsWebGL()

  return (
    <SmoothScroll>
      <PreloaderProgress minShowMs={600} reduced={reduced} />

      {/* fixed full-screen 3D layer, decorative for assistive tech — UNA scena persistente */}
      <div className="canvas-layer" aria-hidden="true">
        {webglOk ? (
          <Stage dpr={dpr}>
            <Scene
              reduced={reduced}
              detail={detail}
              amplitude={amplitude}
              flowScale={tier === 'low' ? 0.5 : 1}
            />
            {/* blueprint 04: satellite pointer-rig — proprio useFrame, mai la camera */}
            <RigSatellite reduced={reduced} />
          </Stage>
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
        <KineticType copy={kineticCopy} reduced={reduced} />
        <PointerRig3d copy={pointerCopy} reduced={reduced} />

        <section id="outro" className="outro">
          <div className="outro__inner">
            <h2 className="outro__title">{outroCopy.headline}</h2>
            <p className="outro__body">{outroCopy.body}</p>
            <p className="outro__footnote">{outroCopy.footnote}</p>
          </div>
        </section>
      </main>
    </SmoothScroll>
  )
}

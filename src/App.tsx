import { useRef } from 'react'
import { SmoothScroll } from './scroll/SmoothScroll'
import { ScrollProgressDriver } from './scroll/ScrollProgressDriver'
import { Stage } from './canvas/Stage'
import { Scene } from './canvas/Scene'
import { Poster } from './canvas/Poster'
import { Overlay } from './ui/Overlay'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useQualityTier } from './hooks/useQualityTier'
import { supportsWebGL } from './lib/webgl'

export default function App() {
  // Single source of scroll progress (0..1). Lives in a ref: no per-frame re-renders.
  const scrollProgress = useRef(0)

  const reduced = useReducedMotion()
  const { detail, amplitude, dpr } = useQualityTier()
  const webglOk = supportsWebGL()

  return (
    <SmoothScroll>
      {/* writes scrollProgress.current from the tall track below */}
      <ScrollProgressDriver progress={scrollProgress} trigger="#scene-track" />

      {/* fixed full-screen 3D layer, decorative for assistive tech */}
      <div className="canvas-layer" aria-hidden="true">
        {webglOk ? (
          <Stage dpr={dpr}>
            <Scene
              scrollProgress={scrollProgress}
              reduced={reduced}
              detail={detail}
              amplitude={amplitude}
            />
          </Stage>
        ) : (
          <Poster />
        )}
      </div>

      {/* scrollable DOM content above the canvas */}
      <main className="content">
        {/* the tall track defines how long the scroll-driven morph lasts */}
        <section id="scene-track" className="scene-track">
          <Overlay reduced={reduced} />
        </section>

        <section id="built-to-extend" className="outro">
          <h2 className="outro__title">Built to extend</h2>
          <p className="outro__body">
            This is the architect's skeleton: a single render loop, one owner per property, WebGPU
            with a WebGL2 fallback, a no-WebGL poster, reduced-motion support, and a documented
            uniform contract. The shader, motion, UI, and audit agents build on top from here.
          </p>
        </section>
      </main>
    </SmoothScroll>
  )
}

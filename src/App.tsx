import { useState } from 'react'
import { Stage } from './canvas/Stage'
import { Scene } from './canvas/Scene'
import { Poster } from './canvas/Poster'
import { ControlPanel } from './ui/ControlPanel'
import { SimClockProvider } from './sim/SimClock'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useQualityTier, type QualityTier } from './hooks/useQualityTier'
import { supportsWebGL } from './lib/webgl'

/** Fixed seed for a stable city across reloads. Swap to a UI control later if desired. */
const CITY_SEED = 1337

export default function App() {
  const reduced = useReducedMotion()

  // Quality: detected by default; the panel can force a tier (null = auto).
  const [override, setOverride] = useState<QualityTier | null>(null)
  const tier = useQualityTier(override ?? undefined)

  const webglOk = supportsWebGL()

  return (
    <SimClockProvider>
      <div className="app">
        {/* Fullscreen 3D layer — decorative for assistive tech; real controls live in the panel. */}
        <div className="canvas-layer" aria-hidden="true">
          {webglOk ? (
            <Stage dpr={tier.dpr} fallback={<Poster />}>
              {/* key remounts the Scene when the baked-in tier or seed changes (grid/car counts). */}
              <Scene key={`${CITY_SEED}-${tier.tier}`} seed={CITY_SEED} tier={tier} reduced={reduced} />
            </Stage>
          ) : (
            <Poster />
          )}
        </div>

        {/* Accessible DOM UI above the canvas. */}
        <ControlPanel qualityOverride={override} onQualityOverride={setOverride} reduced={reduced} />
      </div>
    </SimClockProvider>
  )
}

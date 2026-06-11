import { useCallback, useRef, useState } from 'react'
import { Stage } from './canvas/Stage'
import { Scene } from './canvas/Scene'
import { Poster } from './canvas/Poster'
import { ControlPanel, TRAFFIC_SPEED_PRESETS } from './ui/ControlPanel'
import { SimClockProvider } from './sim/SimClock'
import { useReducedMotion } from './hooks/useReducedMotion'
import { useQualityTier, type QualityTier } from './hooks/useQualityTier'
import { supportsWebGL } from './lib/webgl'
import type { CameraRigHandle } from './camera/CameraRig'
import type { TrafficSpeedApi } from './motion/useTrafficSpeed'

/**
 * Traffic density levels. Each value is passed to Scene as the car count multiplier.
 * 'bassa' = 0.4×, 'media' = 1×, 'alta' = 1.8× of the tier default count.
 * Changing density remounts the Scene (key changes) because car instances are baked.
 */
export type TrafficDensity = 'bassa' | 'media' | 'alta'

export const DENSITY_MULTIPLIER: Record<TrafficDensity, number> = {
  bassa: 0.4,
  media: 1.0,
  alta: 1.8,
}

/**
 * Initial seed. The user can randomise this via "Nuova città" button.
 * Changing the seed remounts the Scene via key.
 */
const DEFAULT_SEED = 1337

export default function App() {
  const reduced = useReducedMotion()

  // Quality: detected by default; the panel can force a tier (null = auto).
  const [override, setOverride] = useState<QualityTier | null>(null)
  const tier = useQualityTier(override ?? undefined)

  // City seed: randomised by "Nuova città" button.
  const [seed, setSeed] = useState(DEFAULT_SEED)

  // Traffic density: controls how many car instances are created (remounts Scene on change).
  const [density, setDensity] = useState<TrafficDensity>('media')

  // Vehicle-speed preset selection (panel chips). null = tier default, no chip pressed.
  // Owned here (not in the panel) so it survives Scene remounts; mirrored into a ref so the
  // stable handleTrafficSpeedApi callback can read the current value without re-creating.
  const [trafficSpeedIndex, setTrafficSpeedIndexState] = useState<number | null>(null)
  const trafficSpeedIndexRef = useRef<number | null>(null)
  const handleTrafficSpeedIndex = useCallback((idx: number) => {
    trafficSpeedIndexRef.current = idx
    setTrafficSpeedIndexState(idx)
  }, [])

  // Imperative handle refs: populated by Scene via callbacks, forwarded to ControlPanel.
  // These live in refs (not state) so they never trigger re-renders.
  const rigHandleRef = useRef<CameraRigHandle | null>(null)
  const trafficSpeedRef = useRef<TrafficSpeedApi | null>(null)

  const handleRigHandle = useCallback((h: CameraRigHandle) => {
    rigHandleRef.current = h
  }, [])

  const handleTrafficSpeedApi = useCallback((api: TrafficSpeedApi) => {
    trafficSpeedRef.current = api
    // A fresh Scene resets the uniform to the tier default; re-apply the user's explicit
    // selection (if any) so the panel chips and the actual pace stay in sync across remounts.
    const idx = trafficSpeedIndexRef.current
    if (idx !== null) api.setTrafficSpeed(TRAFFIC_SPEED_PRESETS[idx].value, 0)
  }, [])

  const handleNewSeed = useCallback(() => {
    setSeed(Math.floor(Math.random() * 2 ** 31))
  }, [])

  const webglOk = supportsWebGL()

  // Scene key: remount whenever baked-in values change (tier, seed, density).
  const sceneKey = `${seed}-${tier.tier}-${density}`

  return (
    <SimClockProvider>
      <div className="app">
        {/* Fullscreen 3D layer — decorative for assistive tech; real controls live in the panel. */}
        <div className="canvas-layer" aria-hidden="true">
          {webglOk ? (
            <Stage dpr={tier.dpr} fallback={<Poster />}>
              <Scene
                key={sceneKey}
                seed={seed}
                tier={tier}
                reduced={reduced}
                density={density}
                onRigHandle={handleRigHandle}
                onTrafficSpeedApi={handleTrafficSpeedApi}
              />
            </Stage>
          ) : (
            <Poster />
          )}
        </div>

        {/* Accessible DOM UI above the canvas. */}
        <ControlPanel
          qualityOverride={override}
          onQualityOverride={setOverride}
          reduced={reduced}
          density={density}
          onDensity={setDensity}
          rigHandleRef={rigHandleRef}
          trafficSpeedRef={trafficSpeedRef}
          trafficSpeedIndex={trafficSpeedIndex}
          onTrafficSpeedIndex={handleTrafficSpeedIndex}
          onNewSeed={handleNewSeed}
        />
      </div>
    </SimClockProvider>
  )
}

import { useMemo, useRef } from 'react'
import { generateCity } from '../city/generateCity'
import { Buildings } from '../city/Buildings'
import { Ground } from '../city/Ground'
import { Traffic } from '../city/Traffic'
import { Sky } from '../city/Sky'
import { Lighting } from './Lighting'
import { RendererConfig } from './RendererConfig'
import { CameraRig, type CameraRigConfig, type CameraRigHandle } from '../camera/CameraRig'
import { SimClockDriver } from '../sim/SimClockDriver'
import { useTrafficSpeed } from '../motion/useTrafficSpeed'
import type { FloatUniform } from '../city/shaders/trafficMaterial'
import type { TierSettings } from '../hooks/useQualityTier'

/**
 * Assembles the city scene from a seed + quality tier. Integration point for all sub-agent work.
 *
 * Motion engineer additions (2026-06-11):
 *  - CameraRig receives a `handle` ref so the UI agent can call flyTo() presets.
 *  - Traffic receives a `speedScaleRef` so useTrafficSpeed can own uSpeedScale (single writer).
 *  - useTrafficSpeed applies the per-tier default speed and exposes setTrafficSpeed() on the
 *    returned api, which Scene passes up to the App via the `onTrafficSpeedApi` callback.
 *
 * UI agent: to trigger a camera fly-to from the control panel, forward the `rigHandle` ref
 * (exposed on the CameraRig component) up through App and into the panel, then call
 * `rigHandle.current?.flyTo(PRESET_STREET_DUSK)` etc.
 */
interface SceneProps {
  seed: number
  tier: TierSettings
  reduced: boolean
  /** Called once with the camera rig's imperative handle so App/UI can trigger fly-tos. */
  onRigHandle?: (handle: CameraRigHandle) => void
  /** Called once with the traffic speed API so App/UI can drive the speed slider. */
  onTrafficSpeedApi?: (api: { setTrafficSpeed: (multiplier: number, duration?: number) => void }) => void
}

export function Scene({ seed, tier, reduced }: SceneProps) {
  const city = useMemo(() => generateCity(seed, tier.gridSize), [seed, tier.gridSize])

  // Camera + shadow framing derive from the city size so they scale with the tier automatically.
  const cameraConfig = useMemo<CameraRigConfig>(() => {
    const e = city.extent
    return {
      target: [0, 8, 0], // look slightly above ground so the skyline fills the frame
      minDistance: e * 0.4,
      maxDistance: e * 2.4,
      distance: e * 1.3,
      minPolar: 0.15, // near-top-down allowed
      maxPolar: Math.PI / 2 - 0.08, // never reach/penetrate the ground plane
    }
  }, [city.extent])

  const sunDistance = city.extent * 2.2
  const shadowExtent = city.extent * 1.15

  // ── Camera rig handle ref (for fly-to presets via the UI agent) ─────────────────────────────
  const rigHandle = useRef<CameraRigHandle | null>(null)

  // ── Traffic speed ownership ─────────────────────────────────────────────────────────────────
  // speedScaleRef is populated by Traffic's useLayoutEffect once the material is created.
  const speedScaleRef = useRef<FloatUniform | null>(null)
  // useTrafficSpeed applies per-tier defaults and exposes setTrafficSpeed to the UI.
  useTrafficSpeed(tier.tier, speedScaleRef)

  return (
    <>
      <RendererConfig shadows={tier.shadows} />
      <Lighting />
      <SimClockDriver
        reduced={reduced}
        shadows={tier.shadows}
        shadowMapSize={tier.shadowMapSize}
        sunDistance={sunDistance}
        shadowExtent={shadowExtent}
      />

      <Sky radius={city.extent * 30} />
      <Ground ground={city.ground} roads={city.roads} sidewalks={city.sidewalks} />
      <Buildings buildings={city.buildings} tier={tier} />
      <Traffic lanes={city.lanes} carCount={tier.carCount} seed={seed} speedScaleRef={speedScaleRef} />

      <CameraRig config={cameraConfig} reduced={reduced} handle={rigHandle} />

      {/* [PEDESTRIANS — stretch, high tier only] documented extension point, intentionally not built.
          Add here: an instanced low-poly pedestrian mesh on sidewalk lanes (city.sidewalks give the
          strips; derive walk paths like buildCarInstances derives car lanes), animated in TSL the
          same way as Traffic. Gate behind tier.tier === 'high'. */}
    </>
  )
}

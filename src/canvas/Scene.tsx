import { useMemo } from 'react'
import { generateCity } from '../city/generateCity'
import { Buildings } from '../city/Buildings'
import { Ground } from '../city/Ground'
import { Traffic } from '../city/Traffic'
import { Lighting } from './Lighting'
import { RendererConfig } from './RendererConfig'
import { CameraRig, type CameraRigConfig } from '../camera/CameraRig'
import { SimClockDriver } from '../sim/SimClockDriver'
import type { TierSettings } from '../hooks/useQualityTier'

/**
 * Assembles the city scene from a seed + quality tier. This is the integration point every other
 * agent's work plugs into:
 *   - layout: pure generated data (city/generateCity)
 *   - meshes: Buildings / Ground / Traffic (instanced; shader engineer swaps materials)
 *   - sim:    SimClockDriver (the single time owner; drives sun + shared uniforms)
 *   - camera: CameraRig (motion engineer tunes)
 *   - lights: Lighting (constant fill) + the sun (inside SimClockDriver)
 */
interface SceneProps {
  seed: number
  tier: TierSettings
  reduced: boolean
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

      <Ground ground={city.ground} roads={city.roads} sidewalks={city.sidewalks} />
      <Buildings buildings={city.buildings} tier={tier} />
      <Traffic lanes={city.lanes} carCount={tier.carCount} seed={seed} />

      <CameraRig config={cameraConfig} reduced={reduced} />

      {/* [PEDESTRIANS — stretch, high tier only] documented extension point, intentionally not built.
          Add here: an instanced low-poly pedestrian mesh on sidewalk lanes (city.sidewalks give the
          strips; derive walk paths like buildCarInstances derives car lanes), animated in TSL the
          same way as Traffic. Gate behind tier.tier === 'high'. */}
    </>
  )
}

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, FogExp2, type DirectionalLight } from 'three'
import { useSimClock, advanceClock } from './SimClock'
import { computeSun, computeSkyColor, makeSunState, type SunState } from './sun'
import { simUniforms } from './uniforms'

/**
 * The single per-frame owner of sim time.
 *
 * This is the ONE useFrame that advances the clock and pushes the result everywhere it is
 * read: the shared TSL uniforms (uTime, uDayPhase, uDaylight, uSunDirection), the sun
 * DirectionalLight (position + color + intensity), and the scene background + fog color.
 * Nothing else writes those values.
 *
 * It renders the sun as a declarative <directionalLight> (the single shadow caster) and drives
 * its transform/color imperatively each frame via the ref.
 */
interface Props {
  reduced: boolean
  shadows: boolean
  shadowMapSize: number
  /** Distance to place the (directional) sun light from origin so its shadow frustum frames the city. */
  sunDistance: number
  /** Orthographic shadow camera half-size; should comfortably cover the city extent. */
  shadowExtent: number
}

export function SimClockDriver({ reduced, shadows, shadowMapSize, sunDistance, shadowExtent }: Props) {
  const clock = useSimClock()
  const scene = useThree((s) => s.scene)
  const sunLightRef = useRef<DirectionalLight>(null)
  const sun = useMemo<SunState>(() => makeSunState(), [])
  const skyColor = useMemo(() => new Color(), [])

  // Own the scene fog + background here (single writer). Exponential fog reads as atmospheric
  // haze and hides the city edge so the grid never looks like it "ends" abruptly.
  useEffect(() => {
    const fog = new FogExp2(0x88a0b8, 0.0016)
    const prevFog = scene.fog
    const prevBg = scene.background
    scene.fog = fog
    // Assigned once; the frame loop mutates this Color in place, so no per-frame scene write.
    scene.background = skyColor
    return () => {
      scene.fog = prevFog
      scene.background = prevBg
    }
  }, [scene, skyColor])

  useFrame((_state, delta) => {
    // delta is already seconds; clamp to avoid huge jumps after a tab is backgrounded.
    const dt = Math.min(delta, 0.1)
    const s = clock.ref.current
    advanceClock(s, dt, reduced)

    // monotonic time still advances under reduced-motion? No: keep uTime tied to sim so a frozen
    // sim also freezes traffic/flicker, matching the reduced-motion intent. The panel can scrub.
    simUniforms.uTime.value = s.simSeconds
    simUniforms.uDayPhase.value = s.dayPhase

    computeSun(s.dayPhase, sun)
    simUniforms.uDaylight.value = sun.daylight
    simUniforms.uSunDirection.value.copy(sun.direction)

    const light = sunLightRef.current
    if (light) {
      light.position.copy(sun.direction).multiplyScalar(sunDistance)
      light.color.copy(sun.color)
      // keep a soft floor so the city is never pitch black; window lights carry the night.
      light.intensity = 0.05 + sun.intensity * 1.6
    }

    // atmosphere: background + fog color track the time of day (single writer). Both Color
    // objects are already attached to the scene; mutate them in place.
    computeSkyColor(sun.daylight, skyColor)
    if (scene.fog && 'color' in scene.fog) (scene.fog.color as Color).copy(skyColor)
  })

  return (
    <directionalLight
      ref={sunLightRef}
      castShadow={shadows}
      shadow-mapSize-width={shadowMapSize}
      shadow-mapSize-height={shadowMapSize}
      shadow-camera-near={1}
      shadow-camera-far={sunDistance * 2.5}
      shadow-camera-left={-shadowExtent}
      shadow-camera-right={shadowExtent}
      shadow-camera-top={shadowExtent}
      shadow-camera-bottom={-shadowExtent}
      shadow-bias={-0.0004}
    />
  )
}

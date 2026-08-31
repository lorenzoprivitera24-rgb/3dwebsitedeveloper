import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MathUtils, Vector3 } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  uniform,
  positionLocal,
  normalLocal,
  mx_fractal_noise_float,
  time,
  vec3,
} from 'three/tsl'
import { sceneTargets } from './sceneState'
import { usePointerSignal } from '../lib/pointerRef'
import { TOKENS } from '../lib/tokens.generated'

interface Props {
  reduced: boolean
  detail: number
  amplitude: number
}

// The signature element: a form that morphs from two eased signals.
//   uMorph   (0..1)  : global opening, damped toward sceneTargets.morph (the CameraDirector
//                      computes it from the section progress map — one owner per level).
//   uPointer (vec3)  : local bulge toward the cursor / touch point (xy in -1..1).
// The emissive tint comes from the tokens (no color exists outside direction.md).
export function MorphingForm({ reduced, detail, amplitude }: Props) {
  // NON state.pointer: l'overlay .content copre il canvas fixed e gli eventi non arrivano
  // all'elemento canvas — il segnale condiviso ascolta a livello window (vedi lib/pointerRef).
  const pointer = usePointerSignal()

  const { material, uMorph, uPointer } = useMemo(() => {
    const uMorph = uniform(0)
    const uPointer = uniform(new Vector3(0, 0, 0))
    const uAmplitude = uniform(amplitude)
    const emissive = new Color(TOKENS.gradient.b)

    const m = new MeshStandardNodeMaterial({
      color: '#0e1118',
      roughness: 0.22,
      metalness: 0.1,
    })

    // animated fractal turbulence across the surface
    const turbulence = mx_fractal_noise_float(positionLocal.mul(1.4).add(time.mul(0.2)))

    // a soft bulge that grows the closer a vertex (in xy) is to the pointer
    const pointerBulge = positionLocal.xy.sub(uPointer.xy).length().oneMinus().clamp(0, 1)

    // the director's morph opens the whole form; the pointer punches it locally
    const totalDisplacement = uMorph.mul(uAmplitude).add(pointerBulge.mul(0.3))

    // push each vertex along its normal
    m.positionNode = positionLocal.add(normalLocal.mul(turbulence).mul(totalDisplacement))

    // subtle emissive that brightens as the form opens (token gradient.b, not a hardcoded color)
    m.emissiveNode = vec3(emissive.r, emissive.g, emissive.b).mul(uMorph.mul(0.35))

    return { material: m, uMorph, uPointer }
  }, [amplitude])

  useEffect(() => () => material.dispose(), [material])

  useFrame((_state, delta) => {
    // morph: floaty so the transition reads as a scene change, not a twitch
    uMorph.value = MathUtils.damp(uMorph.value, sceneTargets.morph, 4, delta)
    if (reduced) {
      uPointer.value.set(0, 0, 0)
      return
    }
    // pointer: snappy enough to feel responsive
    uPointer.value.x = MathUtils.damp(uPointer.value.x, pointer.x, 6, delta)
    uPointer.value.y = MathUtils.damp(uPointer.value.y, pointer.y, 6, delta)
  })

  return (
    <mesh material={material}>
      {/* detail comes from the quality tier: lower on mobile, higher on desktop */}
      <icosahedronGeometry args={[1.4, detail]} />
    </mesh>
  )
}

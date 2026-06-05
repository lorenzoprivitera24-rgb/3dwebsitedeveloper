import { useMemo, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MathUtils } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  uniform,
  positionLocal,
  normalLocal,
  mx_fractal_noise_float,
  time,
  vec3,
} from 'three/tsl'

interface Props {
  scrollProgress: MutableRefObject<number>
  reduced: boolean
  detail: number
  amplitude: number
}

// The signature element: a form that morphs from two eased signals.
//   uScroll  (0..1)  : global morph, driven by smoothed scroll progress.
//   uPointer (vec3)  : local bulge toward the cursor / touch point (xy in -1..1).
// The shader (TSL node graph) declares the uniforms; this component, acting as the motion owner,
// drives them in useFrame with framerate-independent damping.
//
// [shader engineer] extension point: layer more noise octaves, add a chromatic colorNode,
// or branch on renderer.isWebGPURenderer to spawn a WebGPU compute particle field.
export function MorphingForm({ scrollProgress, reduced, detail, amplitude }: Props) {
  // R3F unifies mouse and touch into state.pointer ([-1, 1] on x and y). Works on phones as is.
  const pointer = useThree((s) => s.pointer)

  const { material, uScroll, uPointer } = useMemo(() => {
    const uScroll = uniform(0)
    const uPointer = uniform(vec3(0, 0, 0))
    const uAmplitude = uniform(amplitude)

    const m = new MeshStandardNodeMaterial({
      color: '#0e1118',
      roughness: 0.22,
      metalness: 0.1,
    })

    // animated fractal turbulence across the surface
    const turbulence = mx_fractal_noise_float(positionLocal.mul(1.4).add(time.mul(0.2)))

    // a soft bulge that grows the closer a vertex (in xy) is to the pointer
    const pointerBulge = positionLocal.xy.sub(uPointer.xy).length().oneMinus().clamp(0, 1)

    // scroll opens the whole form; the pointer punches it locally
    const totalDisplacement = uScroll.mul(uAmplitude).add(pointerBulge.mul(0.3))

    // push each vertex along its normal
    m.positionNode = positionLocal.add(normalLocal.mul(turbulence).mul(totalDisplacement))

    // subtle emissive that brightens as the user scrolls, for a sense of life
    m.emissiveNode = vec3(0.15, 0.45, 1.0).mul(uScroll.mul(0.35))

    return { material: m, uScroll, uPointer }
  }, [amplitude])

  useFrame((_state, delta) => {
    if (reduced) {
      // calm, near-static: ease toward a gentle constant, ignore the pointer entirely
      uScroll.value = MathUtils.damp(uScroll.value, 0.12, 4, delta)
      uPointer.value.set(0, 0, 0)
      return
    }
    // pointer: snappy enough to feel responsive
    uPointer.value.x = MathUtils.damp(uPointer.value.x, pointer.x, 6, delta)
    uPointer.value.y = MathUtils.damp(uPointer.value.y, pointer.y, 6, delta)
    // scroll: floatier so the morph reads as a transition, not a twitch
    uScroll.value = MathUtils.damp(uScroll.value, scrollProgress.current, 4, delta)
  })

  return (
    <mesh material={material}>
      {/* detail comes from the quality tier: lower on mobile, higher on desktop */}
      <icosahedronGeometry args={[1.4, detail]} />
    </mesh>
  )
}

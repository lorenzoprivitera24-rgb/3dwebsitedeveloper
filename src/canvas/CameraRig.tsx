import type { MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'

interface Props {
  scrollProgress: MutableRefObject<number>
  reduced: boolean
}

// The camera is owned here and nowhere else (single owner per property).
// [motion engineer] extension point: replace this continuous path with a GSAP scrubbed timeline
// if you want discrete keyframed stops. Do not drive the camera from two places at once.
export function CameraRig({ scrollProgress, reduced }: Props) {
  useFrame((state) => {
    if (reduced) {
      state.camera.position.set(0, 0, 6)
      state.camera.lookAt(0, 0, 0)
      return
    }
    const p = scrollProgress.current
    state.camera.position.z = MathUtils.lerp(6, 3.2, p)
    state.camera.position.y = Math.sin(p * Math.PI) * 0.8
    state.camera.lookAt(0, 0, 0)
  })

  return null
}

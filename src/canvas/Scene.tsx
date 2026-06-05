import type { MutableRefObject } from 'react'
import { CameraRig } from './CameraRig'
import { MorphingForm } from './MorphingForm'

interface SceneProps {
  scrollProgress: MutableRefObject<number>
  reduced: boolean
  detail: number
  amplitude: number
}

// Minimal lighting on purpose: one key light, one cool rim, low ambient.
// [shader/ui engineer] extension point: swap to an Environment map (drei) for richer reflections.
export function Scene({ scrollProgress, reduced, detail, amplitude }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 4]} intensity={1.2} />
      <directionalLight position={[-4, -2, -3]} intensity={0.45} color="#5b8cff" />

      <CameraRig scrollProgress={scrollProgress} reduced={reduced} />
      <MorphingForm
        scrollProgress={scrollProgress}
        reduced={reduced}
        detail={detail}
        amplitude={amplitude}
      />
    </>
  )
}

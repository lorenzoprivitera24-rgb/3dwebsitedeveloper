import type { MutableRefObject } from 'react'
import { Environment } from '@react-three/drei'
import { CameraRig } from './CameraRig'
import { MorphingForm } from './MorphingForm'

interface SceneProps {
  scrollProgress: MutableRefObject<number>
  reduced: boolean
  detail: number
  amplitude: number
}

// IBL-first lighting: one self-hosted CC0 HDRI does the fill/reflections, analytic lights only
// shape the form (key + cool rim). NEVER use drei's <Environment preset>: it downloads from a
// third-party CDN at runtime (GDPR + reliability). For a "studio product" look, replace files=
// with an <Environment resolution={256}> containing a <Lightformer> rig.
export function Scene({ scrollProgress, reduced, detail, amplitude }: SceneProps) {
  return (
    <>
      <Environment files="/hdri/studio_small_08_1k.hdr" environmentIntensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={0.9} />
      <directionalLight position={[-4, -2, -3]} intensity={0.3} color="#5b8cff" />

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

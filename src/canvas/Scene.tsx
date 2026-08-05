import { Environment } from '@react-three/drei'
import { CameraDirector } from './CameraDirector'
import { GradientBackdrop } from './GradientBackdrop'
import { MorphingForm } from './MorphingForm'
import { QaSceneBridge } from '../qa/QaSceneBridge'
import { qaEnabled } from '../qa/bridge'

interface SceneProps {
  reduced: boolean
  detail: number
  amplitude: number
  /** dal tier: dimezza il flow del gradient su low */
  flowScale?: number
}

// LA scena persistente della demo composta: una sola, per tutta la pagina. I capitoli
// (hero → gradient → scrub → kinetic) vivono nel CameraDirector, che consuma la progress map
// scritta dai blueprint DOM. IBL-first: un HDRI CC0 self-host fa fill/riflessi, le analitiche
// danno solo forma (key + rim). MAI <Environment preset>: scarica da CDN terza (GDPR).
export function Scene({ reduced, detail, amplitude, flowScale = 1 }: SceneProps) {
  return (
    <>
      <Environment files="/hdri/studio_small_08_1k.hdr" environmentIntensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={0.9} />
      <directionalLight position={[-4, -2, -3]} intensity={0.3} color="#5b8cff" />

      <CameraDirector reduced={reduced} />
      <GradientBackdrop reduced={reduced} flowScale={flowScale} />
      <MorphingForm reduced={reduced} detail={detail} amplitude={amplitude} />

      {/* metà "scena" del ponte QA — montata solo con ?qa=1 (gate di stato) */}
      {qaEnabled() && <QaSceneBridge />}
    </>
  )
}

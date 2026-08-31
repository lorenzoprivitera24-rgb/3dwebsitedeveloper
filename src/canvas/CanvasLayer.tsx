import { lazy, Suspense } from 'react'
import { Stage } from './Stage'
import { Scene } from './Scene'
import { LoadProgressBridge } from './LoadProgressBridge'
import { RigSatellite } from '../../registry/04-pointer-rig-3d/RigSatellite'

// Pannello di accordatura: `import.meta.env.DEV` è staticamente false in produzione, quindi
// Rolldown elimina il ramo e leva non finisce nel bundle (stessa tecnica del DevPerf).
// Sta FUORI da <Stage> perché è DOM: dentro il Canvas il reconciler R3F si aspetta oggetti three.
const LookPanel = import.meta.env.DEV ? lazy(() => import('./GradientLookPanel')) : null

interface Props {
  reduced: boolean
  detail: number
  amplitude: number
  flowScale: number
  dpr: [number, number]
}

// The lazy boundary of the whole 3D layer. App imports THIS with React.lazy(), which is what keeps
// three/webgpu, R3F and drei out of the entry chunk's static graph — see src/lib/loadProgress.ts
// for the full story. Anything that imports three belongs on this side of the boundary.
export default function CanvasLayer({ reduced, detail, amplitude, flowScale, dpr }: Props) {
  return (
    <>
      <LoadProgressBridge />
      {LookPanel && (
        <Suspense fallback={null}>
          <LookPanel />
        </Suspense>
      )}
      <Stage dpr={dpr}>
        <Scene reduced={reduced} detail={detail} amplitude={amplitude} flowScale={flowScale} />
        {/* blueprint 04: satellite pointer-rig — proprio useFrame, mai la camera */}
        <RigSatellite reduced={reduced} />
      </Stage>
    </>
  )
}

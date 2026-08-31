import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { registerSceneHalf, type QaState } from './bridge'

type Waiter = { framesLeft: number; resolve: () => void }
type Sampler = { left: number; out: number[]; resolve: (v: number[]) => void }

// La metà "scena" del ponte QA: vive DENTRO il <Canvas> (l'unico posto da cui si vedono
// renderer, camera e il conteggio dei frame realmente disegnati).
//
// `settle` conta FRAME, non millisecondi: il damping è framerate-independent, quindi contare
// i frame è ciò che rende ripetibile l'assestamento anche su macchine di velocità diversa.
//
// GOTCHA MISURATO (backend WebGPU, three 0.185) — `renderer.info.render` si comporta in due
// modi diversi nello stesso oggetto:
//   · `calls`     ACCUMULA fra i frame (mai azzerato): letto grezzo cresce con la durata della
//                 sessione. Va diviso per i frame trascorsi.
//   · `triangles` viene azzerato a ogni frame, quindi è già un valore per-frame...
//   · ...ma SOLO se lo si legge DOPO il render. `useFrame` gira PRIMA, e lì `triangles` vale 0.
// Per questo lo snapshot si prende da fuori il loop (chiamata da Playwright), mai dentro.
export function QaSceneBridge() {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const frame = useRef(0)
  const waiters = useRef<Waiter[]>([])
  const samplers = useRef<Sampler[]>([])
  // ancora dello snapshot precedente, per ricavare le draw call per frame
  const last = useRef<{ calls: number; frame: number } | null>(null)

  useEffect(() => {
    return registerSceneHalf({
      settle: (frames) =>
        new Promise<void>((resolve) => {
          waiters.current.push({ framesLeft: Math.max(1, frames), resolve })
        }),
      frameSamples: (n) =>
        new Promise<number[]>((resolve) => {
          samplers.current.push({ left: Math.max(1, n), out: [], resolve })
        }),
      snapshot: (): Omit<QaState, 'progressMap' | 'sceneTargets' | 'probes' | 'reduced'> => {
        const info = (gl as unknown as { info?: Record<string, Record<string, number>> }).info
        const backendObj = (gl as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend
        const cam = camera as typeof camera & { fov?: number; aspect?: number }

        const rawCalls = info?.render?.calls ?? -1
        const elapsed = last.current ? frame.current - last.current.frame : 0
        const dCalls = last.current ? rawCalls - last.current.calls : 0
        const callsPerFrame =
          elapsed > 0 && dCalls > 0 ? Math.round((dCalls / elapsed) * 10) / 10 : rawCalls
        last.current = { calls: rawCalls, frame: frame.current }

        return {
          camera: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            fov: cam.fov ?? 0,
            aspect: cam.aspect ?? 0,
          },
          render: {
            calls: callsPerFrame,
            triangles: info?.render?.triangles ?? -1,
            geometries: info?.memory?.geometries ?? -1,
            textures: info?.memory?.textures ?? -1,
          },
          backend:
            backendObj === undefined ? 'unknown' : backendObj.isWebGPUBackend ? 'WebGPU' : 'WebGL2',
          dpr: gl.getPixelRatio(),
          frame: frame.current,
        }
      },
    })
  }, [gl, camera])

  useFrame((_state, delta) => {
    frame.current += 1

    if (waiters.current.length > 0) {
      const still: Waiter[] = []
      for (const w of waiters.current) {
        w.framesLeft -= 1
        if (w.framesLeft <= 0) w.resolve()
        else still.push(w)
      }
      waiters.current = still
    }

    if (samplers.current.length > 0) {
      const still: Sampler[] = []
      for (const s of samplers.current) {
        s.out.push(delta * 1000)
        s.left -= 1
        if (s.left <= 0) s.resolve(s.out)
        else still.push(s)
      }
      samplers.current = still
    }
  })

  return null
}

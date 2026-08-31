import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { makeGradientFieldMaterial } from './materials/gradientField'
import { registerGradientLook } from './materials/lookRegistry'
import { sceneTargets } from './sceneState'
import { registerQaProbe } from '../qa/registry'
import { usePointerSignal } from '../lib/pointerRef'
import { TOKENS } from '../lib/tokens.generated'
import look from '../../looks/03-gradient.json'

interface Props {
  reduced: boolean
  /** moltiplicatore del flow per il tier (0 = campo fermo su low/reduced) */
  flowScale?: number
}

// Il quad del blueprint 03-mesh-gradient-field: sta DENTRO la scena persistente, dietro la
// forma, e appare/scompare seguendo sceneTargets.gradientMix (scritto dal CameraDirector).
// Questo componente è l'unico scrittore dei propri uniform (damp dai target).
export function GradientBackdrop({ reduced, flowScale = 1 }: Props) {
  // segnale condiviso a livello window (state.pointer è inerte sotto l'overlay .content)
  const pointer = usePointerSignal()
  const { material, uniforms, lookUniforms } = useMemo(() => makeGradientFieldMaterial(look), [])

  // Espone le manopole al pannello Leva (dev). In produzione nessuno legge il registro.
  useEffect(() => {
    registerGradientLook(lookUniforms)
    return () => registerGradientLook(null)
  }, [lookUniforms])

  // il flow riparte SEMPRE dal token (mai dal valore corrente: un toggle di reduced lo
  // azzererebbe per sempre); dispose del materiale al dismount
  useEffect(() => {
    uniforms.uFlow.value = reduced ? 0 : TOKENS.gradient.flow * flowScale
  }, [uniforms, reduced, flowScale])
  useEffect(() => () => material.dispose(), [material])

  // Sonda per il gate di stato: uMix deve convergere a sceneTargets.gradientMix.
  useEffect(() => registerQaProbe('uMix', () => uniforms.uMix.value), [uniforms])

  useFrame((_state, delta) => {
    const lambda = reduced ? 1.5 : 3
    uniforms.uMix.value = MathUtils.damp(uniforms.uMix.value, sceneTargets.gradientMix, lambda, delta)
    if (!reduced) {
      uniforms.uPointer.value.x = MathUtils.damp(uniforms.uPointer.value.x, pointer.x, 4, delta)
      uniforms.uPointer.value.y = MathUtils.damp(uniforms.uPointer.value.y, pointer.y, 4, delta)
    }
  })

  return (
    <mesh material={material} position={[0, 0, -6]} renderOrder={-1}>
      <planeGeometry args={[36, 20]} />
    </mesh>
  )
}

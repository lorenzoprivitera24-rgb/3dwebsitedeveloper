import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three/webgpu'
import { mrt, output, normalView, pass, vec3, vec4 } from 'three/tsl'
import { ao } from 'three/addons/tsl/display/GTAONode.js'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { smaa } from 'three/addons/tsl/display/SMAANode.js'
import type { PostLevel } from '../hooks/useQualityTier'

interface Props {
  /** Dal tier: 'off' non monta nulla, 'medium' = GTAO+SMAA, 'full' aggiunge il bloom. */
  level: PostLevel
}

// La catena di post NATIVA del percorso WebGPU (ROADMAP «Reusable PostFX module»; MAI
// @react-three/postprocessing qui — combatte il node renderer, resta legittimo solo su build
// deliberatamente WebGL2-only). Grafo: scenePass con MRT(output+normalView) → GTAO → [bloom] →
// SMAA. Il tonemapping NON è nel grafo: RenderPipeline applica da solo l'output transform del
// renderer (AgX + sRGB) in coda, quindi la casa vince senza doppie applicazioni.
//
// Integrazione R3F: il render lo fa QUESTO componente da un useFrame a priority 1 — con una
// priority > 0 R3F spegne il proprio auto-render e la pipeline diventa l'unico presentatore
// del frame (un solo owner, come per la camera).
//
// AA: antialias:true resta giusto (MSAA multicampiona il pass off-screen); SMAA in coda pulisce
// l'aliasing da shader/alpha che l'MSAA geometrico non vede. Su 'medium' il bloom sparisce
// (è il pezzo che costa); su 'off' non montare proprio il componente.
export function PostFX({ level }: Props) {
  const gl = useThree((s) => s.gl) as unknown as THREE.WebGPURenderer
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)

  const pipeline = useMemo(() => {
    if (level === 'off') return null

    const scenePass = pass(scene, camera)
    scenePass.setMRT(mrt({ output, normal: normalView }))

    const scenePassColor = scenePass.getTextureNode('output')
    const scenePassNormal = scenePass.getTextureNode('normal')
    const scenePassDepth = scenePass.getTextureNode('depth')

    // GTAO: l'unico nodo AO del percorso WebGPU (HBAO non esiste). Il suo target è RedFormat:
    // si compone moltiplicando il SOLO canale r — vec3(ao.r) — mai il texel intero.
    const aoPass = ao(scenePassDepth, scenePassNormal, camera)
    const occluded = vec4(scenePassColor.rgb.mul(vec3(aoPass.getTextureNode().r)), scenePassColor.a)
    // il bloom si SOMMA (ritorna le alte luci sfocate, non l'immagine intera); su 'medium' non c'è
    const lit = level === 'full' ? occluded.add(bloom(occluded, 0.35, 0.4, 0.85)) : occluded

    const post = new THREE.RenderPipeline(gl)
    post.outputNode = smaa(lit)
    return post
  }, [gl, scene, camera, level])

  useEffect(() => {
    return () => pipeline?.dispose()
  }, [pipeline])

  // priority 1: da qui in poi il frame lo presenta la pipeline, non l'auto-render di R3F
  useFrame(() => {
    pipeline?.render()
  }, 1)

  return null
}

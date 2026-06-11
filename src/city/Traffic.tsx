import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  InstancedBufferAttribute,
  Matrix4,
  type InstancedMesh,
} from 'three'
import type { Lane } from './types'
import { buildCarInstances } from './buildCarInstances'
import { makeTrafficMaterial } from './shaders/trafficMaterial'

/**
 * Traffic: a single InstancedMesh of car bodies, one draw call for all cars.
 *
 * THE ARCHITECT provides: the box car geometry, the InstancedMesh, and the per-instance
 * attributes (aLaneStart, aLaneDir, aLaneLength, aPhase, aSpeed, aCar) attached to the geometry.
 * As a PLACEHOLDER, the instance matrices park each car at its lane start so the scene renders
 * something before the shader is in.
 *
 * THE SHADER ENGINEER OWNS the motion: replace the material's positionNode to compute the car's
 * world position from `simUniforms.uTime` + the per-instance attributes (see buildCarInstances.ts
 * for the exact formula), orient the body along aLaneDir, set the body colorNode from aCar.x, and
 * add emissive headlights/taillights gated by `simUniforms.uDaylight`. The static instance matrix
 * below is then effectively overridden by positionNode each frame; leave the attributes + geometry
 * wiring intact. The optional WebGPU compute enhancement is documented in ARCHITECTURE.md.
 */

// Car body: a low box, base near the road deck. Unit-ish, scaled lightly per-car by the shader.
const CAR_W = 2.0
const CAR_H = 1.5
const CAR_L = 4.4

function makeCarGeometry(): BoxGeometry {
  const g = new BoxGeometry(CAR_W, CAR_H, CAR_L)
  g.translate(0, CAR_H / 2, 0) // sit the body on the deck
  return g
}

function setAttr(geometry: BoxGeometry, name: string, array: Float32Array, itemSize: number) {
  const attr = new InstancedBufferAttribute(array, itemSize)
  attr.setUsage(35044 /* StaticDrawUsage */)
  geometry.setAttribute(name, attr)
}

export function Traffic({
  lanes,
  carCount,
  seed,
}: {
  lanes: Lane[]
  carCount: number
  seed: number
}) {
  const meshRef = useRef<InstancedMesh>(null)
  const buffers = useMemo(() => buildCarInstances(lanes, carCount, seed), [lanes, carCount, seed])
  const geometry = useMemo(() => makeCarGeometry(), [])
  // The TSL car material: motion + heading + per-car colour + night head/tail lights, all on the GPU.
  const { material } = useMemo(() => makeTrafficMaterial(), [])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || buffers.count === 0) return

    // attach all per-instance attributes the car material consumes
    setAttr(geometry, 'aLaneStart', buffers.laneStart, 3)
    setAttr(geometry, 'aLaneDir', buffers.laneDir, 3)
    setAttr(geometry, 'aLaneLength', buffers.laneLength, 1)
    setAttr(geometry, 'aPhase', buffers.phase, 1)
    setAttr(geometry, 'aSpeed', buffers.speed, 1)
    setAttr(geometry, 'aCar', buffers.car, 2)

    // Identity instance matrices: the material's positionNode fully owns each car's transform
    // (lane motion + heading + scale) from the per-instance attributes, so the instance matrix
    // must NOT add a second transform on top. We keep an InstancedMesh purely for the one-draw-call
    // batching + clean per-instance attribute wiring.
    const identity = new Matrix4()
    for (let i = 0; i < buffers.count; i++) mesh.setMatrixAt(i, identity)
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [buffers, geometry])

  if (buffers.count === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, buffers.count]}
      castShadow
      receiveShadow
      name="traffic"
      // frustum culling off: positionNode will move cars far from the static bounding sphere
      // once the shader engineer is in, so disable CPU culling to avoid them popping out.
      frustumCulled={false}
    />
  )
}

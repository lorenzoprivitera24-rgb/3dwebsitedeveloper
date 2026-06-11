import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  InstancedBufferAttribute,
  Object3D,
  type InstancedMesh,
} from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import type { Lane } from './types'
import { buildCarInstances } from './buildCarInstances'

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
  const material = useMemo(
    // Placeholder: flat dark body. Shader engineer replaces colorNode/positionNode/emissiveNode.
    () => new MeshStandardNodeMaterial({ color: '#c8ccd2', roughness: 0.35, metalness: 0.6 }),
    [],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh || buffers.count === 0) return

    // attach all per-instance attributes the shader engineer will consume
    setAttr(geometry, 'aLaneStart', buffers.laneStart, 3)
    setAttr(geometry, 'aLaneDir', buffers.laneDir, 3)
    setAttr(geometry, 'aLaneLength', buffers.laneLength, 1)
    setAttr(geometry, 'aPhase', buffers.phase, 1)
    setAttr(geometry, 'aSpeed', buffers.speed, 1)
    setAttr(geometry, 'aCar', buffers.car, 2)

    // PLACEHOLDER static placement: park each car at its lane start, facing aLaneDir.
    const dummy = new Object3D()
    for (let i = 0; i < buffers.count; i++) {
      const sx = buffers.laneStart[i * 3 + 0]
      const sy = buffers.laneStart[i * 3 + 1]
      const sz = buffers.laneStart[i * 3 + 2]
      const dx = buffers.laneDir[i * 3 + 0]
      const dz = buffers.laneDir[i * 3 + 2]
      dummy.position.set(sx, sy, sz)
      dummy.rotation.set(0, Math.atan2(dx, dz), 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
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

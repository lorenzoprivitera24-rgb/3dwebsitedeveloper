import { useLayoutEffect, useMemo, useRef } from 'react'
import { PlaneGeometry, Object3D, type InstancedMesh } from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import type { GroundQuad } from './types'

/**
 * The horizontal surfaces: one big ground slab, plus instanced road and sidewalk quads.
 *
 * All quads are unit planes laid flat (rotated -90deg about X) and scaled per-instance. Roads
 * and sidewalks each become a single InstancedMesh (2 draw calls), so the whole street network
 * is cheap regardless of grid size.
 *
 * [shader engineer] OWNS these materials. Swap in procedural asphalt (lane markings via UV),
 * sidewalk concrete, and a ground tint. The placeholders below are flat colors. Geometry +
 * instance placement wiring stays as-is.
 */

function makeUnitPlane(): PlaneGeometry {
  const g = new PlaneGeometry(1, 1)
  g.rotateX(-Math.PI / 2) // lay flat on the XZ plane, normal +Y
  return g
}

export function Ground({
  ground,
  roads,
  sidewalks,
}: {
  ground: GroundQuad
  roads: GroundQuad[]
  sidewalks: GroundQuad[]
}) {
  const groundGeo = useMemo(() => makeUnitPlane(), [])
  const groundMat = useMemo(
    () => new MeshStandardNodeMaterial({ color: '#2b2f36', roughness: 1.0, metalness: 0.0 }),
    [],
  )

  return (
    <group name="ground-and-streets">
      {/* single ground slab */}
      <mesh
        geometry={groundGeo}
        material={groundMat}
        position={ground.position}
        scale={[ground.size[0], 1, ground.size[1]]}
        receiveShadow
        name="ground"
      />

      <QuadInstances quads={roads} color="#15171c" roughness={0.9} name="roads" />
      <QuadInstances quads={sidewalks} color="#4a4f57" roughness={0.95} name="sidewalks" />
    </group>
  )
}

function QuadInstances({
  quads,
  color,
  roughness,
  name,
}: {
  quads: GroundQuad[]
  color: string
  roughness: number
  name: string
}) {
  const meshRef = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => makeUnitPlane(), [])
  const material = useMemo(
    () => new MeshStandardNodeMaterial({ color, roughness, metalness: 0.0 }),
    [color, roughness],
  )

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = new Object3D()
    for (let i = 0; i < quads.length; i++) {
      const q = quads[i]
      dummy.position.set(q.position[0], q.position[1], q.position[2])
      dummy.scale.set(q.size[0], 1, q.size[1])
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [quads])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, quads.length]}
      receiveShadow
      name={name}
    />
  )
}

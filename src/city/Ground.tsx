import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  PlaneGeometry,
  Object3D,
  InstancedBufferAttribute,
  type InstancedMesh,
  type Material,
} from 'three'
import type { GroundQuad } from './types'
import {
  makeRoadMaterial,
  makeSidewalkMaterial,
  makeGroundMaterial,
} from './shaders/groundMaterials'

/**
 * The horizontal surfaces: one big ground slab, plus instanced road and sidewalk quads.
 *
 * All quads are unit planes laid flat (rotated -90deg about X) and scaled per-instance. Roads
 * and sidewalks each become a single InstancedMesh (2 draw calls), so the whole street network
 * is cheap regardless of grid size.
 *
 * [shader engineer] Materials are now procedural TSL (groundMaterials.ts): asphalt + dashed lane
 * markings, sidewalk concrete, dark ground slab. The road material reads a per-instance `aQuad`
 * attribute = [sizeX, sizeZ] (the strip's world footprint) so it can find the run-axis and draw the
 * centre line; that attribute is uploaded here. Geometry + instance placement wiring is unchanged.
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
  const groundMat = useMemo(() => makeGroundMaterial(), [])
  const roadMat = useMemo(() => makeRoadMaterial(), [])
  const sidewalkMat = useMemo(() => makeSidewalkMaterial(), [])

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

      {/* roads carry the aQuad size attribute for the lane-marking shader */}
      <QuadInstances quads={roads} material={roadMat} name="roads" withQuadAttr />
      <QuadInstances quads={sidewalks} material={sidewalkMat} name="sidewalks" />
    </group>
  )
}

function QuadInstances({
  quads,
  material,
  name,
  withQuadAttr = false,
}: {
  quads: GroundQuad[]
  material: Material
  name: string
  withQuadAttr?: boolean
}) {
  const meshRef = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => makeUnitPlane(), [])

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

    if (withQuadAttr) {
      // per-instance world footprint so the road shader knows its run-axis + short width.
      const arr = new Float32Array(quads.length * 2)
      for (let i = 0; i < quads.length; i++) {
        arr[i * 2 + 0] = quads[i].size[0]
        arr[i * 2 + 1] = quads[i].size[1]
      }
      const attr = new InstancedBufferAttribute(arr, 2)
      attr.setUsage(35044 /* StaticDrawUsage */)
      mesh.geometry.setAttribute('aQuad', attr)
    }
  }, [quads, withQuadAttr])

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, quads.length]}
      receiveShadow
      name={name}
    />
  )
}

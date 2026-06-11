import { useLayoutEffect, useMemo, useRef } from 'react'
import {
  BoxGeometry,
  InstancedBufferAttribute,
  Object3D,
  type InstancedMesh,
} from 'three'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import type { BuildingArchetype, BuildingInstance } from './types'
import type { TierSettings } from '../hooks/useQualityTier'

/**
 * Buildings: one InstancedMesh per archetype (3 draw calls total for the whole skyline).
 *
 * Each archetype is a UNIT box (1x1x1, base at y=0) reused for every instance; the per-instance
 * matrix scales it to (footprint.w, height, footprint.d) and translates to its slot, so a single
 * geometry covers all sizes. Per-instance facade data (seed, litBias) is uploaded as an
 * InstancedBufferAttribute named `aFacade` (vec2 = [facadeSeed, litBias]).
 *
 * [shader engineer] OWNS the material's appearance. Replace the placeholder
 * MeshStandardNodeMaterial's colorNode / emissiveNode / roughnessNode with the procedural
 * facade. Read per-instance data with `instancedBufferAttribute(theAFacadeAttribute)` (vec2)
 * OR re-create it via `attribute('aFacade','vec2')`; and read the sim via `simUniforms`
 * (uDayPhase / uDaylight) to drive lit windows at night. Keep the geometry + instance matrix
 * wiring below untouched.
 */
interface Props {
  buildings: BuildingInstance[]
  tier: TierSettings
}

// A unit box whose BASE sits on y=0 (so scaling Y grows it upward, not from the center).
function makeBaseBox(segments: number): BoxGeometry {
  const g = new BoxGeometry(1, 1, 1, segments, segments, segments)
  g.translate(0, 0.5, 0) // move pivot to the base
  return g
}

function placeholderMaterial(): MeshStandardNodeMaterial {
  // Neutral concrete-ish stand-in. The shader engineer replaces the node graph in place.
  return new MeshStandardNodeMaterial({ color: '#9aa3ad', roughness: 0.82, metalness: 0.0 })
}

const ARCH_ORDER: BuildingArchetype[] = ['lowrise', 'midrise', 'tower']

export function Buildings({ buildings, tier }: Props) {
  // group instances by archetype so each InstancedMesh holds one geometry/material.
  const groups = useMemo(() => {
    const byArch: Record<BuildingArchetype, BuildingInstance[]> = {
      lowrise: [],
      midrise: [],
      tower: [],
    }
    for (const b of buildings) byArch[b.archetype].push(b)
    return byArch
  }, [buildings])

  return (
    <group name="buildings">
      {ARCH_ORDER.map((arch) =>
        groups[arch].length > 0 ? (
          <BuildingArchetypeMesh
            key={arch}
            archetype={arch}
            instances={groups[arch]}
            segments={tier.buildingSegments}
          />
        ) : null,
      )}
    </group>
  )
}

function BuildingArchetypeMesh({
  archetype,
  instances,
  segments,
}: {
  archetype: BuildingArchetype
  instances: BuildingInstance[]
  segments: number
}) {
  const meshRef = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => makeBaseBox(segments), [segments])
  const material = useMemo(() => placeholderMaterial(), [])

  // per-instance facade attribute: vec2 [facadeSeed, litBias]
  const facadeArray = useMemo(() => {
    const arr = new Float32Array(instances.length * 2)
    for (let i = 0; i < instances.length; i++) {
      arr[i * 2 + 0] = instances[i].facadeSeed
      arr[i * 2 + 1] = instances[i].litBias
    }
    return arr
  }, [instances])

  useLayoutEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const dummy = new Object3D()
    for (let i = 0; i < instances.length; i++) {
      const b = instances[i]
      dummy.position.set(b.position[0], 0, b.position[2])
      dummy.scale.set(b.footprint[0], b.height, b.footprint[1])
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()

    // attach the facade attribute to the instanced geometry under a stable name.
    const attr = new InstancedBufferAttribute(facadeArray, 2)
    attr.setUsage(35044 /* StaticDrawUsage */)
    mesh.geometry.setAttribute('aFacade', attr)
  }, [instances, facadeArray])

  return (
    <instancedMesh
      ref={meshRef}
      // args: [geometry, material, count]
      args={[geometry, material, instances.length]}
      castShadow
      receiveShadow
      name={`buildings-${archetype}`}
    />
  )
}

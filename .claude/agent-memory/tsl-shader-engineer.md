# tsl-shader-engineer — project memory (live city sim)

## Verified r184 TSL facts (checked against vendored three.js/src + installed npm build)

- `three/tsl` exports VALUES only; the `Node` *type* is NOT re-exported there. Import it as a type
  from `three/webgpu`: `import type { Node } from 'three/webgpu'`. Then `Node<'float'|'vec2'|'vec3'>`
  carry the swizzle + math `NodeElements` augmentations.
- `@types/three` TSL typings are STRICT and type-aware per node type (swizzles, per-type math
  overloads). Two gotchas:
  - `attribute('name','vec3')` infers `TNodeType = string` (the literal is widened), giving
    `AttributeNode<string>` with NO `.x`/`.mul`. Fix: `attribute(...) as unknown as Node<'vec3'>`.
    This cast is the correct contained escape hatch — used in every material here.
  - `uniform(1)` => `UniformNode<'float', number>`. To expose its type without importing the generic,
    capture it: `const _f = () => uniform(0); type FloatUniform = ReturnType<typeof _f>`.
- Helpers (hash/value-noise) are written as PLAIN functions composing nodes (not `Fn(...)`), typed
  with `Node<...>` params. Cleanly type-checks; inlines into the graph. See `city/shaders/tslHelpers.ts`.
  Hashing uses sin/fract value-hash (NO integer bit-ops) so WGSL and GLSL match.
- `rotate(posVec3, vec3(0, yaw, 0))` (utils/RotateNode) = Euler rotation; use for car heading.
- `atan(y, x)` two-arg => `atan2(y, x)` (GLSL native atan2; WGSL maps to atan2). Contract heading is
  `atan2(dir.x, dir.z)` => call `atan(dir.x, dir.z)`.
- `select(cond, ifTrue, ifFalse)` (math/ConditionalNode). Comparisons: `.greaterThan()`, `.lessThan()`.
- `MeshBasicNodeMaterial` / `MeshStandardNodeMaterial` exported from `three/webgpu`. `.fog`, `.colorNode`,
  `.emissiveNode`, `.roughnessNode`, `.metalnessNode`, `.positionNode` all valid.
- `emissiveNode`, when set, REPLACES the emissive term (NodeMaterial.js ~L1109: `emissive.assign(vec3(emissiveNode))`,
  added to outgoing light). Not multiplied by base `emissive`/`emissiveIntensity`. So set absolute strength.

## CRITICAL instancing gotcha

InstancedMesh TSL path does `positionLocal.assign(instanceMatrix * positionLocal)` (accessors/Instance.js).
So for an InstancedMesh:
- If you OVERRIDE `positionNode` using `positionLocal`, you DOUBLE-transform (instance matrix + your formula).
  -> For Traffic: I set instance matrices to IDENTITY and build positionNode from `positionGeometry`
     (raw pre-instance unit box). The material fully owns the car transform.
- If you DON'T override positionNode (Buildings, Ground): the instance matrix places/scales correctly,
  and `positionWorld` reflects it (in meters) — but `modelScale` is the MESH scale (identity for
  InstancedMesh), so it CANNOT tell you a per-instance size. -> Facades + roads use `positionWorld`
  (world meters) for size-independent patterns. Roads also got a per-instance `aQuad=[sizeX,sizeZ]`
  attribute (added in Ground.tsx) to know run-axis + short width for the centre line.

## Ownership respected

- Never wrote the shared sim uniforms (uTime/uDayPhase/uDaylight/uSunDirection) — read-only in graphs.
- Sky is an owned dome; did NOT touch `scene.background`/`scene.fog` (SimClockDriver's single-writer).
- Did NOT claim `toneMappingExposure` (left constant in RendererConfig, architect-owned).
- Added one material-local uniform `uSpeedScale` (traffic), documented for the motion engineer.

## Files I own

`city/shaders/tslHelpers.ts`, `city/shaders/trafficMaterial.ts`, `city/shaders/buildingMaterial.ts`,
`city/shaders/groundMaterials.ts`, `city/Sky.tsx`. Wired into Traffic.tsx, Buildings.tsx, Ground.tsx,
Scene.tsx. PlaneGeometry uv after rotateX(-90): uv.x->worldX, uv.y->worldZ.

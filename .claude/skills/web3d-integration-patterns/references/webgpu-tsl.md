# WebGPU + TSL + React Three Fiber v9 (June 2026)

Deep reference for the rendering layer. The SKILL.md gives the summary; this file gives the working detail.

## 1. Project setup

```bash
# React 19 + Vite is the reference setup
npm create vite@latest my-3d-site -- --template react-ts
cd my-3d-site

npm i three @react-three/fiber@^9 @react-three/drei
npm i gsap @gsap/react lenis
# optional, only if the brief needs them:
npm i @react-three/postprocessing
npm i @react-three/rapier ecctrl
npm i @react-spring/three
npm i motion          # DOM UI only (this is the package formerly known as framer-motion)
```

Notes:
- Pin React to 19.x. R3F v9 bundles its own reconciler and is compatible with React 19.0 to 19.2.
- Do not install `framer-motion-3d`. It is discontinued and breaks on React 19.
- Always check the actual installed `three` version (`npm ls three`) rather than assuming a release number. WebGPU has been zero-config since r171 (Sept 2025); use the latest stable.

## 2. The async WebGPU renderer in R3F v9

The `WebGPURenderer` requires `await renderer.init()`. R3F v9 supports this by letting the `gl` prop return a Promise.

```tsx
// canvas/Stage.tsx
import * as THREE from 'three/webgpu'
import { Canvas, extend, type ThreeToJSXElements } from '@react-three/fiber'

// Make the WebGPU primitives and node materials available as JSX elements
declare module '@react-three/fiber' {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}
extend(THREE as any)

export function Stage({ children }: { children: React.ReactNode }) {
  return (
    <Canvas
      gl={async (props) => {
        const renderer = new THREE.WebGPURenderer(props as any)
        await renderer.init()
        return renderer
      }}
      camera={{ position: [0, 0, 6], fov: 45 }}
      dpr={[1, 2]}
      // frameloop can be "always" | "demand" | "never"; see performance-and-fallback.md
    >
      {children}
    </Canvas>
  )
}
```

Common mistakes:

```tsx
// WRONG: renderer not initialized
gl={(canvas) => new THREE.WebGPURenderer({ canvas })}

// CORRECT: await init, return the renderer
gl={async (canvas) => {
  const r = new THREE.WebGPURenderer({ canvas })
  await r.init()
  return r
}}
```

## 3. Detecting the active backend

WebGPU does not expose `gl.capabilities.isWebGL2`. Use the renderer flag.

```tsx
import { useThree } from '@react-three/fiber'

function useBackend() {
  const renderer = useThree((s) => s.gl) // still named `gl` in the store accessor
  return renderer.isWebGPURenderer ? 'webgpu' : 'webgl2'
}
```

Use this to branch: e.g. enable compute-based particles only on WebGPU, fall back to an instanced points cloud on WebGL2.

## 4. TSL: writing shaders as nodes

TSL is imported from `three/tsl`. It is a graph: you compose nodes and assign them to material slots (`positionNode`, `colorNode`, `normalNode`, `emissiveNode`, ...). The same graph compiles to WGSL and GLSL.

Frequently used nodes:
- Inputs: `uniform`, `attribute`, `positionLocal`, `positionWorld`, `normalLocal`, `uv`, `time`, `cameraPosition`
- Math: `.add .sub .mul .div .pow .mix .clamp .smoothstep .length .normalize .dot .cross`
- Noise / patterns: `mx_noise_float`, `mx_fractal_noise_float`, `mx_cell_noise_float` (MaterialX nodes), `triNoise3D`
- Trig: `sin`, `cos`
- Conditionals: `select`, `If` (control flow node)

### 4.1 Vertex displacement node material

```tsx
import { MeshStandardNodeMaterial } from 'three/webgpu'
import {
  uniform, positionLocal, normalLocal, mx_noise_float, time, float,
} from 'three/tsl'

export function makeDisplacementMaterial() {
  const uAmplitude = uniform(0.0) // drive this from scroll/pointer
  const uFrequency = uniform(1.5)

  const material = new MeshStandardNodeMaterial({ roughness: 0.3, metalness: 0.05 })

  const n = mx_noise_float(positionLocal.mul(uFrequency).add(time.mul(0.25)))
  // push each vertex along its normal by the noise, scaled by the amplitude
  material.positionNode = positionLocal.add(normalLocal.mul(n).mul(uAmplitude))

  return { material, uAmplitude, uFrequency }
}
```

### 4.2 Color / RGB shift in the fragment stage

```tsx
import { uv, vec3, mix, uniform } from 'three/tsl'

const uShift = uniform(0.0)
// sample a base color and offset channels slightly for a chromatic feel
material.colorNode = vec3(
  someTexture.sample(uv().add(uShift)).r,
  someTexture.sample(uv()).g,
  someTexture.sample(uv().sub(uShift)).b,
)
```

### 4.3 Reusing TSL between WebGPU and WebGL2

Because TSL is renderer-agnostic, the same `material` works whether `renderer.init()` resolved to WebGPU or fell back to WebGL2. You generally do not maintain two shader code paths; you only branch on *features* that WebGL2 lacks (compute shaders).

## 5. Compute shaders (WebGPU only)

The compute pipeline runs general-purpose work on the GPU. The headline use is large particle systems and physics where per-frame CPU updates would be the bottleneck.

```tsx
import { instancedArray, instanceIndex, Fn, uniform, vec3 } from 'three/tsl'

const COUNT = 200_000
const positions = instancedArray(COUNT, 'vec3')
const velocities = instancedArray(COUNT, 'vec3')
const uDelta = uniform(0.016)

// a compute kernel run once per particle per frame
const updateParticles = Fn(() => {
  const p = positions.element(instanceIndex)
  const v = velocities.element(instanceIndex)
  p.addAssign(v.mul(uDelta))
})().compute(COUNT)

// in the render loop:
function tick(renderer, delta) {
  uDelta.value = delta
  renderer.computeAsync(updateParticles)
}
```

On WebGL2, replace this with a smaller instanced points cloud animated in `useFrame`, or a precomputed animation, gated by the backend check in section 3.

## 6. Post-processing

Drei's `EffectComposer` wraps `pmndrs/postprocessing`. Some effects need WebGPU/TSL variants or behave differently under WebGPU. Keep post FX optional and measure: bloom and DOF are the most common cost spikes. Apply the backend check before enabling compute-heavy passes.

## 7. Loading 3D assets

- Use `useGLTF` from drei, with Draco/Meshopt compression for the model files.
- Preload with `useGLTF.preload(url)`.
- Wrap the scene in `<Suspense>` with a real loader UI.
- Dispose textures/geometries you swap out at runtime.

## 8. Checklist for the scene architect

- [ ] `gl` prop is async and calls `await renderer.init()`
- [ ] `extend(THREE)` from `three/webgpu` so node materials render as JSX
- [ ] Backend detection in place; compute features gated to WebGPU
- [ ] `dpr={[1, 2]}` (never an uncapped device pixel ratio)
- [ ] Lights kept minimal; environment via `Environment` from drei
- [ ] Assets compressed (Draco/Meshopt) and preloaded
- [ ] A single render/scroll loop (Lenis + gsap.ticker), see scroll-pointer-driven.md

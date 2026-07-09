---
name: tsl-gradient-cookbook
description: >
  Ricette TSL parametriche per gli effetti-firma del genere (mesh gradient animato, grana,
  vignetta, reveal a maschera, ripple dal puntatore): uniform esposte, costo per tier, fonti
  sicure. Usare quando serve un background/effetto shader 2D o quando il tsl-shader-engineer
  parte da zero su un effetto. Trigger: "mesh gradient", "sfondo animato shader", "grana",
  "reveal maschera", "ripple", "effetto tipo Framer Shaders".
---

# TSL gradient cookbook — effetti parametrici, un codice per due backend

Regole di bottega: (1) TSL sempre (`three/tsl`), mai GLSL puro — compila WGSL+GLSL; (2) ogni
ricetta espone **uniform nominate** inizializzate dai token (`src/lib/tokens.generated.ts`) —
il creative-director cambia il look senza toccare shader; (3) fonte sicura n°1 = gli esempi
ufficiali `three/examples/webgpu_*` (MIT). **Licenze**: Shadertoy è CC BY-NC-SA di default
(vietato su lavoro cliente), Lygia richiede licenza commerciale — non importarne funzioni.

## 1. Mesh gradient animato (l'effetto-firma, sezione "Powered by AI" del genere)

Quad full-screen + rumore MaterialX incluso in three. Costo: quasi nulla su desktop, ok mobile.

```ts
import * as THREE from 'three/webgpu'
import { Fn, uniform, uv, vec2, vec3, mix, time, mx_noise_float } from 'three/tsl'
import { TOKENS } from '@/lib/tokens.generated'

export const gradientUniforms = {
  colorA: uniform(new THREE.Color(TOKENS.gradient.a)),
  colorB: uniform(new THREE.Color(TOKENS.gradient.b)),
  colorC: uniform(new THREE.Color(TOKENS.gradient.c)),
  flow: uniform(TOKENS.gradient.flow),        // velocità del campo
  pointer: uniform(new THREE.Vector2(0, 0)),  // scritto damped dal rig puntatore
}

export function makeGradientMaterial() {
  const m = new THREE.MeshBasicNodeMaterial()
  m.colorNode = Fn(() => {
    const p = uv().mul(3.0).add(gradientUniforms.pointer.mul(0.4))
    const n1 = mx_noise_float(vec3(p, time.mul(gradientUniforms.flow)))
    const n2 = mx_noise_float(vec3(p.mul(2.0), time.mul(gradientUniforms.flow).add(7.0)))
    const base = mix(gradientUniforms.colorA, gradientUniforms.colorB, n1.mul(0.5).add(0.5))
    return mix(base, gradientUniforms.colorC, n2.mul(0.25).add(0.25))
  })()
  return m
}
```

Chi scrive `pointer`/`flow`: UN solo owner (scroll-motion-engineer), damped con `MathUtils.damp`.

## 2. Grana + vignetta (il "quasi gratis" che fa premium)

Sul colore del materiale o come nodo finale: grana = `mx_noise_float(vec3(uv().mul(risoluzione),
time))` moltiplicata a ±2-4% del colore; vignetta = `smoothstep` sulla distanza dal centro UV,
moltiplicata al colore. Niente catena post per questo: dentro il `colorNode` costa zero pass.
(Ricorda il gotcha di kit: pipeline post custom fragile al resize → [[webgpu-tsl-runtime-gotchas]];
grana/vignetta nel materiale aggirano il problema.)

## 3. Reveal a maschera (gallery, immagini che si svelano)

Uniform `progress` 0→1 (scritta da ScrollTrigger scrub): `opacityNode = smoothstep(progress,
progress + morbidezza, uv().y + rumore*0.1)`. Varianti: direzione via `mix(uv().x, uv().y, asse)`,
bordo irregolare aggiungendo `mx_noise_float` alla soglia. Mobile: morbidezza ↑, rumore ↓.

## 4. Pointer-ripple su immagine (dal recon di Framer Shaders, lug 2026)

Distorsione UV radiale attorno al puntatore damped: `dist = uv().distance(pointerUv)`,
`offset = sin(dist*freq - time*vel) * exp(-dist*decay) * ampiezza`, campiona la texture a
`uv().add(dir.mul(offset))`. Ampiezza 0 su reduced-motion e su tier low. È il candidato
blueprint `pointer-ripple-image` del registro.

## Costi per tier (gate del perf-auditor)

`low`: solo gradient statico (flow=0) o poster. `medium`: gradient + grana. `full`: tutto,
ripple incluso. Un effetto = un materiale riusato, mai N istanze di materiale per N sezioni.

import { useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three/webgpu'
import { Color, DataTexture, RGBAFormat, RepeatWrapping, SRGBColorSpace } from 'three'
import { useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { RigidBody } from '@react-three/rapier'
import { Stage } from '../canvas/Stage'
import { PostFX } from '../canvas/PostFX'
import { InstancedField } from '../canvas/InstancedField'
import { PhysicsStage } from '../canvas/physics/PhysicsStage'
import { makePbrTriplanarMaterial } from '../canvas/materials/pbrTriplanar'
import { asAlphaHashed } from '../canvas/materials/alphaModes'
import { useQualityTier } from '../hooks/useQualityTier'
import { useReducedMotion } from '../hooks/useReducedMotion'

// La camera del lab non ha un director: una mira sola, fissata al mount.
function LabLookAt() {
  const camera = useThree((s) => s.camera)
  useLayoutEffect(() => {
    camera.lookAt(0, 1, 0)
  }, [camera])
  return null
}

// Albedo procedurale seminato (value noise 2 ottave): il lab non dipende da asset scaricati e
// resta deterministico per i gate pixel. In produzione al suo posto arriva una KTX2 ETC1S.
function makeNoiseAlbedo(size = 256): DataTexture {
  let a = 0x1234567
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const coarse = Array.from({ length: 8 * 8 }, rand)
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * 8
      const gy = (y / size) * 8
      const x0 = Math.floor(gx) % 8
      const y0 = Math.floor(gy) % 8
      const fx = gx - Math.floor(gx)
      const fy = gy - Math.floor(gy)
      const v00 = coarse[y0 * 8 + x0]
      const v10 = coarse[y0 * 8 + ((x0 + 1) % 8)]
      const v01 = coarse[((y0 + 1) % 8) * 8 + x0]
      const v11 = coarse[((y0 + 1) % 8) * 8 + ((x0 + 1) % 8)]
      const v = v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy
      const i = (y * size + x) * 4
      // terra bruna con variazione — abbastanza contrasto da rendere il tiling visibile SE ci fosse
      data[i] = 82 + v * 46
      data[i + 1] = 66 + v * 38
      data[i + 2] = 50 + v * 26
      data[i + 3] = 255
    }
  }
  const tex = new DataTexture(data, size, size, RGBAFormat)
  tex.wrapS = tex.wrapT = RepeatWrapping
  tex.colorSpace = SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

// Il LABORATORIO delle discipline di realismo (?lab=1): monta in una scena sola tutti i moduli
// della ROADMAP NEXT — IBL self-host, terreno pbrTriplanar (albedo procedurale), InstancedField
// col vento multi-strato, alphaHash su un velo in dissolvenza, rapier (2 corpi che cadono),
// PostFX dal tier. Vive dietro il confine lazy (import dinamico da App): il grafo dell'entry
// non lo vede, i gate della demo nemmeno (nessuna sezione, nessun baseline).
export default function RealismLab() {
  const { tier, dpr, postLevel, particleCount, physicsEnabled, windOctaves } = useQualityTier()
  const reduced = useReducedMotion()

  const groundMaterial = useMemo(
    () =>
      makePbrTriplanarMaterial({
        albedoMap: makeNoiseAlbedo(),
        scale: 0.5,
        sharpness: 8,
        dualScale: true,
        roughness: 0.95,
      }),
    [],
  )

  // velo alphaHash: dimostra la via «dissolvenza senza sorting» (chiede TAA/SMAA in post)
  const hashMaterial = useMemo(() => {
    const m = new THREE.MeshStandardNodeMaterial()
    m.color = new Color('#9db4ff')
    m.opacity = 0.55
    return asAlphaHashed(m)
  }, [])

  return (
    <div className="canvas-layer" aria-hidden="true" style={{ position: 'fixed', inset: 0 }}>
      <Stage dpr={dpr} cameraPosition={[0, 2.4, 7.5]}>
        <LabLookAt />
        <Environment files="/hdri/studio_small_08_1k.hdr" environmentIntensity={0.9} />
        <directionalLight position={[4, 6, 3]} intensity={1.4} />

        {/* terreno: triplanar a doppia scala — nessuna UV, nessun tiling visibile */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} material={groundMaterial}>
          <circleGeometry args={[12, 48]} />
        </mesh>

        {/* il campo instanziato: budget dal tier, vento a ottave dal tier */}
        <InstancedField count={particleCount} windOctaves={windOctaves} reduced={reduced} />

        {/* eroe IBL: metallo satinato che legge l'ambiente */}
        <mesh position={[0, 1.5, 0]}>
          <torusKnotGeometry args={[0.55, 0.2, 128, 24]} />
          <meshStandardNodeMaterial color="#c8ccd4" metalness={0.9} roughness={0.25} />
        </mesh>

        {/* velo alphaHash in piedi dietro l'eroe */}
        <mesh position={[-1.8, 1.2, -1.2]} material={hashMaterial}>
          <planeGeometry args={[1.6, 2.4]} />
        </mesh>

        {/* fisica: due corpi che cadono sul collider del terreno (rapier unico owner) */}
        <PhysicsStage enabled={physicsEnabled && !reduced}>
          <RigidBody colliders="ball" position={[1.6, 3.2, 0.8]} restitution={0.55}>
            <mesh>
              <icosahedronGeometry args={[0.28, 2]} />
              <meshStandardNodeMaterial color="#b3542e" roughness={0.6} />
            </mesh>
          </RigidBody>
          <RigidBody colliders="ball" position={[2.1, 4.4, -0.4]} restitution={0.4}>
            <mesh>
              <icosahedronGeometry args={[0.2, 2]} />
              <meshStandardNodeMaterial color="#3e5c76" roughness={0.5} />
            </mesh>
          </RigidBody>
          <RigidBody type="fixed" colliders="hull">
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} visible={false}>
              <circleGeometry args={[12, 24]} />
              <meshStandardNodeMaterial />
            </mesh>
          </RigidBody>
        </PhysicsStage>

        <PostFX level={postLevel} />
      </Stage>
      <div
        style={{
          position: 'fixed', left: 12, bottom: 10, fontFamily: 'monospace', fontSize: 11,
          color: '#9aa3b2', pointerEvents: 'none',
        }}
      >
        realism lab · tier {tier} · post {postLevel} · field {particleCount} · wind ×{windOctaves}
      </div>
    </div>
  )
}

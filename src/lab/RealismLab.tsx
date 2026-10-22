import { useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three/webgpu'
import {
  Color,
  DataTexture,
  Matrix4,
  Quaternion,
  RGBAFormat,
  RepeatWrapping,
  SRGBColorSpace,
  Vector3,
  type InstancedMesh,
  type Mesh,
  type Object3D,
} from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
// SOLO tipi: rapier passa dal palco
import type { InstancedRigidBodyProps, WorldStepCallback } from '@react-three/rapier'
import { Stage } from '../canvas/Stage'
import { PostFX } from '../canvas/PostFX'
import { InstancedField } from '../canvas/InstancedField'
import {
  declaredJoint,
  PhysicsBody,
  PhysicsCollider,
  PhysicsInstancedBodies,
  PhysicsMeshCollider,
  PhysicsStage,
  PhysicsStep,
  usePhysics,
} from '../canvas/physics/PhysicsStage'
import { LANYARD, Lanyard } from '../canvas/physics/Lanyard'
import { makePbrTriplanarMaterial } from '../canvas/materials/pbrTriplanar'
import { asAlphaHashed } from '../canvas/materials/alphaModes'
import { useQualityTier, type QualityTier } from '../hooks/useQualityTier'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { qaEnabled } from '../qa/bridge'

// La camera del lab non ha un director: una mira sola, fissata al mount.
function LabLookAt() {
  const camera = useThree((s) => s.camera)
  useLayoutEffect(() => {
    camera.lookAt(0, 1, 0)
  }, [camera])
  return null
}

type Triple = [number, number, number]

// Da dove partono i corpi che cadono: la posa del markup, letta anche dalla sonda. Il raggio del
// primo è quello della sua mesh e del suo collider esplicito.
const DROP_FROM: Triple = [1.6, 3.2, 0.8]
const DROP_RADIUS = 0.28
const SECOND_FROM: Triple = [2.1, 4.4, -0.4]
// I cubetti istanziati (PhysicsInstancedBodies): un corpo per istanza, una mesh sola. Con la fisica
// cadono sul terreno, senza restano nella posa delle `instances`.
const CUBE = 0.24
const CUBES: InstancedRigidBodyProps[] = (
  [
    [[-0.9, 2.6, 1.7], [0.3, 0.2, 0]],
    [[-0.45, 3.1, 2.0], [0.1, 0.7, 0.4]],
    [[-1.35, 3.5, 1.5], [0.6, 0, 0.2]],
  ] as [Triple, Triple][]
).map(([position, rotation], key) => ({ key, position, rotation }))
// Il Lanyard del kit (tre corde e l'aggancio sferico della card, tutti PhysicsJoint), a metà
// scala, appeso a sinistra del velo: con la fisica parte con gli anelli in orizzontale e cade,
// senza pende fermo.
const LANYARD_AT: Triple = [-3.2, 4.2, -0.8]
const LANYARD_SCALE = 0.5
// Il terreno: il disco che si vede sta a y = 0, e con la fisica i corpi devono restarci sopra.
// Il suo collider è un cilindro dello stesso raggio con la faccia di sopra a quella quota, spesso
// abbastanza da non farsi attraversare in un passo da un corpo che arriva veloce.
const FLOOR_Y = 0
const FLOOR_RADIUS = 12
const FLOOR_HALF_DEPTH = 0.5

interface LabProbeState {
  tier: QualityTier
  /** la fisica è montata (tier che la concede E niente reduced-motion) */
  physics: boolean
  /** fotogrammi passati dall'albero COMPLETO della scena */
  frames: number
  /** render per fotogramma dal fotogramma STEADY_FROM in poi (NaN prima): 0 = tela mai disegnata */
  rendersPerFrame: number
  /** quota del terreno: con la fisica i corpi cadono e ci restano sopra */
  floorY: number
  /** i corpi che cadono: quota nel markup, e adesso */
  bodies: { name: string; startY: number; y: number }[]
  /** le istanze di PhysicsInstancedBodies: quota nelle `instances`, e adesso */
  instances: { startY: number; y: number }[]
  /** la catena del Lanyard, legata da PhysicsJoint */
  chain: {
    /** giunti nel mondo di rapier (letti con usePhysics), e quelli che il markup dichiara */
    joints: number
    expected: number
    /** passi del mondo visti da PhysicsStep: 0 senza fisica */
    steps: number
    /** di quanto una corda è andata oltre la sua lunghezza, in frazione della lunghezza (0,1 = 10%
     *  più lunga), il massimo di tutta la corsa; -Infinity se nessuna è misurata */
    stretch: number
    /** di quanto l'aggancio sferico della card si è aperto, in unità del mondo, il massimo */
    gap: number
    /** i giunti misurati nell'ultimo passo: senza, l'apertura sarebbe verde per assenza */
    measured: number
    /** spostamento della card dalla prima lettura */
    moved: number
  }
}

declare global {
  interface Window {
    __lab?: LabProbeState
  }
}

// Da qui la finestra dei render è a regime: i passaggi PMREM dell'HDRI e il primo caricamento
// sono alle spalle, quindi quello che conta è solo il disegno di ogni fotogramma.
const STEADY_FROM = 30

// Un'ancora dichiarata, nelle forme che rapier accetta per i giunti: array, numero, oggetto x y z.
function anchor(out: Vector3, value: unknown): Vector3 {
  if (Array.isArray(value)) return out.fromArray(value)
  if (typeof value === 'number') return out.setScalar(value)
  return out.copy(value as Vector3)
}

// La sonda del gate qa:lab (scripts/lab-gate.mjs), armata con ?qa=1 come il ponte QA. Sta nella
// stessa Suspense della scena, quindi conta fotogrammi solo quando HDRI, fisica e post sono
// montati davvero: il gate aspetta fotogrammi, non un timeout (un'attesa a tempo direbbe
// «nessun errore» anche di una scena non ancora salita). Ma un useFrame gira anche se nessuno
// disegna, quindi la sonda conta anche i render (`info.render.calls`, cumulativo: vedi
// QaSceneBridge). Con la fisica i corpi e le istanze cadono e la catena del Lanyard si muove
// restando legata; senza, tutto resta dove il markup lo mette. Sta DENTRO il palco fisico perché
// legge il mondo con usePhysics e i passi con PhysicsStep: le strade del palco, non quelle di rapier.
function LabProbe({
  tier,
  physics,
  bodies,
  cubes,
}: {
  tier: QualityTier
  physics: boolean
  bodies: { name: string; startY: number; mesh: RefObject<Mesh | null> }[]
  cubes: RefObject<InstancedMesh | null>
}) {
  const gl = useThree((s) => s.gl) as unknown as { info: { render: { calls: number } } }
  const scene = useThree((s) => s.scene)
  const stage = usePhysics()
  const frames = useRef(0)
  const callsAtSteady = useRef(0)
  const scratch = useMemo(
    () => ({
      world: new Vector3(),
      a: new Vector3(),
      b: new Vector3(),
      q: new Quaternion(),
      m: new Matrix4(),
      card: null as Object3D | null,
      cardStart: new Vector3(),
      cardSeen: false,
      steps: 0,
      stretch: Number.NEGATIVE_INFINITY,
      gap: Number.NEGATIVE_INFINITY,
      measured: 0,
    }),
    [],
  )

  // Dopo ogni passo del mondo, per ogni corda e ogni aggancio sferico: le ancore che il markup ha
  // DICHIARATO, portate nel mondo coi corpi del motore. Una corda oltre la sua lunghezza si misura
  // in frazione della lunghezza, un aggancio aperto in unità del mondo. Ancore e lunghezze vengono
  // dalla dichiarazione di PhysicsJoint (declaredJoint), non dal giunto di rapier: con le ancore
  // del motore un giunto creato con l'ancora sbagliata risulterebbe chiuso per costruzione, e
  // joint.type() dà Generic a tutti (la sonda della prima ora filtrava su quello, non misurava
  // niente ed era verde per assenza). Il massimo di tutta la corsa, non l'ultimo: una catena che si
  // stacca e poi si ricompone non è rimasta legata.
  const afterStep: WorldStepCallback = (world) => {
    const { a, b, q } = scratch
    scratch.steps += 1
    scratch.measured = 0
    world.impulseJoints.forEach((joint) => {
      const declared = declaredJoint(joint)
      if (declared?.type !== 'rope' && declared?.type !== 'spherical') return
      const b1 = joint.body1()
      const b2 = joint.body2()
      anchor(a, declared.params[0]).applyQuaternion(q.copy(b1.rotation())).add(b1.translation())
      anchor(b, declared.params[1]).applyQuaternion(q.copy(b2.rotation())).add(b2.translation())
      const distance = a.distanceTo(b)
      if (declared.type === 'rope') {
        const length = declared.params[2]
        scratch.stretch = Math.max(scratch.stretch, (distance - length) / length)
      } else scratch.gap = Math.max(scratch.gap, distance)
      scratch.measured += 1
    })
  }

  useFrame(() => {
    frames.current += 1
    const calls = gl.info.render.calls
    if (frames.current === STEADY_FROM) callsAtSteady.current = calls
    const steady = frames.current - STEADY_FROM
    const rendersPerFrame = steady > 0 ? (calls - callsAtSteady.current) / steady : Number.NaN
    const { world, m } = scratch
    // la card: la prima lettura è la partenza, lo spostamento si misura da lì
    scratch.card ??= scene.getObjectByName(LANYARD.card) ?? null
    let moved = Number.NaN
    if (scratch.card) {
      scratch.card.getWorldPosition(world)
      if (!scratch.cardSeen) scratch.cardStart.copy(world)
      scratch.cardSeen = true
      moved = world.distanceTo(scratch.cardStart)
    }
    const mesh = cubes.current
    const instanceY = (i: number) => {
      if (!mesh) return Number.NaN
      mesh.getMatrixAt(i, m)
      return m.elements[13]
    }
    window.__lab = {
      tier,
      physics,
      frames: frames.current,
      rendersPerFrame,
      floorY: FLOOR_Y,
      bodies: bodies.map(({ name, startY, mesh: body }) => ({
        name,
        startY,
        y: body.current ? body.current.getWorldPosition(world).y : Number.NaN,
      })),
      instances: CUBES.map((cube, i) => ({ startY: (cube.position as Triple)[1], y: instanceY(i) })),
      chain: {
        joints: stage ? stage.world.impulseJoints.len() : 0,
        expected: LANYARD.joints,
        steps: scratch.steps,
        stretch: scratch.stretch,
        gap: scratch.gap,
        measured: scratch.measured,
        moved,
      },
    }
  })
  return <PhysicsStep after={afterStep} />
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
  const physics = physicsEnabled && !reduced
  const fallingBody = useRef<Mesh>(null)
  const secondBody = useRef<Mesh>(null)
  const cubes = useRef<InstancedMesh>(null)
  const probedBodies = useMemo(
    () => [
      { name: 'primo', startY: DROP_FROM[1], mesh: fallingBody },
      { name: 'secondo', startY: SECOND_FROM[1], mesh: secondBody },
    ],
    [],
  )

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
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, FLOOR_Y, 0]} material={groundMaterial}>
          <circleGeometry args={[FLOOR_RADIUS, 48]} />
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

        {/* fisica: corpi che cadono sul collider del terreno (rapier unico owner) e il Lanyard */}
        {/* Il palco (PhysicsBody, PhysicsCollider, PhysicsJoint...), mai i componenti di rapier:
            col tier low o con reduced-motion la fisica non monta, e un RigidBody senza <Physics>
            sopra fa cadere tutta la tela sul poster; importati per valore, scaricherebbero il
            motore a ogni tier */}
        <PhysicsStage enabled={physics}>
          {/* il primo corpo ha un collider esplicito (colliders={false}: niente collider
              automatico dalla mesh) */}
          <PhysicsBody colliders={false} position={DROP_FROM} restitution={0.55}>
            <PhysicsCollider shape="ball" args={[DROP_RADIUS]} />
            <mesh ref={fallingBody}>
              <icosahedronGeometry args={[DROP_RADIUS, 2]} />
              <meshStandardNodeMaterial color="#b3542e" roughness={0.6} />
            </mesh>
          </PhysicsBody>
          {/* il secondo i collider automatici dalla sua mesh, ma da PhysicsMeshCollider: senza,
              il corpo non avrebbe collider, cioè massa, e rapier non lo muoverebbe */}
          <PhysicsBody colliders={false} position={SECOND_FROM} restitution={0.4}>
            <PhysicsMeshCollider type="ball">
              <mesh ref={secondBody}>
                <icosahedronGeometry args={[0.2, 2]} />
                <meshStandardNodeMaterial color="#3e5c76" roughness={0.5} />
              </mesh>
            </PhysicsMeshCollider>
          </PhysicsBody>
          {/* un corpo per cubetto, una mesh sola: le matrici le scrive rapier a ogni passo, e
              senza fisica PhysicsInstancedBodies dalle pose delle `instances` */}
          <PhysicsInstancedBodies instances={CUBES} colliders="cuboid" restitution={0.3}>
            <instancedMesh ref={cubes} args={[undefined, undefined, CUBES.length]}>
              <boxGeometry args={[CUBE, CUBE, CUBE]} />
              <meshStandardNodeMaterial color="#c9a227" roughness={0.45} />
            </instancedMesh>
          </PhysicsInstancedBodies>
          {/* i giunti: tre corde e l'aggancio della card, PhysicsJoint dentro il Lanyard */}
          <Lanyard position={LANYARD_AT} scale={LANYARD_SCALE} />
          {/* il terreno è un collider esplicito da solo, fermo nel mondo. Era un PhysicsBody
              fixed attorno a un mesh nascosto con includeInvisible, perché rapier fa i collider
              automatici solo dai mesh visibili: senza, i corpi cadevano nel vuoto (quota -8 dopo
              90 fotogrammi, il gate qa:lab ora lo misura) */}
          <PhysicsCollider
            shape="cylinder"
            args={[FLOOR_HALF_DEPTH, FLOOR_RADIUS]}
            position={[0, FLOOR_Y - FLOOR_HALF_DEPTH, 0]}
          />
          {qaEnabled() && (
            <LabProbe tier={tier} physics={physics} bodies={probedBodies} cubes={cubes} />
          )}
        </PhysicsStage>

        <PostFX level={postLevel} />
      </Stage>
      <div
        style={{
          position: 'fixed', left: 12, bottom: 10, fontFamily: 'monospace', fontSize: 11,
          color: '#9aa3b2', pointerEvents: 'none',
        }}
      >
        realism lab · tier {tier} · post {postLevel} · field {particleCount} · wind ×{windOctaves} ·
        physics {physics ? 'on' : 'off'}
      </div>
    </div>
  )
}

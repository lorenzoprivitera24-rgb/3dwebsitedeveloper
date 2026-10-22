import {
  createContext,
  use,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ComponentProps,
  type ComponentType,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react'
import { Euler, Matrix4, Quaternion, Vector3, type Group, type InstancedMesh } from 'three'
// SOLO tipi (vedi loadRapier)
import type {
  InstancedRigidBodiesProps,
  MeshColliderProps,
  RapierContext,
  RapierRigidBody,
  RigidBodyProps,
  WorldStepCallback,
} from '@react-three/rapier'

// aritmetica di bit, senza motore: si usa a qualunque tier
export { interactionGroups } from './interactionGroups'

interface Props {
  children: ReactNode
  /** Dal tier (physicsEnabled) E dal ramo reduced: false = i figli renderizzano SENZA fisica. */
  enabled: boolean
  /** true in sezioni non pinnate dove la sim può dormire fuori viewport. */
  paused?: boolean
}

type Rapier = typeof import('@react-three/rapier')

// @react-three/rapier si scarica da qui e solo con la fisica accesa. Il modulo importa
// staticamente il motore (@dimforge/rapier3d-compat, il WASM in base64: 2,2 MB, 0,8 MB gzip),
// quindi con un import statico il motore finiva nel chunk di chi importa PhysicsStage e lo
// scaricava anche chi la fisica non la monta: tier low e reduced-motion (22 ott 2026, lo misura
// qa:lab). L'import dinamico gli dà un chunk suo. Una promessa sola per la pagina, perché `use`
// vuole la stessa promessa a ogni render.
// Vale per ogni file: un import di VALORE da @react-three/rapier (un collider, useRapier, un
// giunto, interactionGroups) rimette il motore nel chunk di chi lo importa, a qualunque tier. I
// tipi sono liberi; il resto passa da qui. perf:check lo boccia sul manifest, anche in un file del
// progetto caricato solo a fisica accesa: dalla build non si legge a che tier si carica un chunk.
let rapier: Promise<Rapier> | undefined
const loadRapier = () => (rapier ??= import('@react-three/rapier'))

// Sotto un <Physics> montato da PhysicsStage: il modulo caricato e il contesto del suo mondo (quello
// di useRapier); null altrove. Tutto il palco lo legge per scegliere fra rapier e la scena ferma.
// Il modulo intero, non i soli componenti che servono oggi: quello che manca si aggiunge senza
// toccare il palco.
interface Mounted {
  rapier: Rapier
  physics: RapierContext
}
const PhysicsMounted = createContext<Mounted | null>(null)

// Il palco fisico della ROADMAP NEXT: rapier steppato DENTRO il frame R3F (updateLoop
// "independent" userebbe un suo clock, qui il loop è uno solo: regola 3). Regola dura: rapier è
// l'UNICO owner dei transform dei suoi RigidBody, mai anche damparli a mano (double-owner =
// jitter, ed è il primo check dell'auditor). Semantica reduced-motion scelta kit-wide (era un
// open question della R&D): con enabled=false la fisica NON monta e i figli restano dove il
// markup li mette: scena ferma, niente sim che «gira ma ignora gli impulsi».
//
// Il patto coi figli: rapier si usa SOLO dai componenti di questo file, MAI coi suoi. Un
// RigidBody (e ogni hook o collider di rapier) senza <Physics> sopra lancia «useRapier must be
// used within <Physics />!» e la tela cade sul poster: è successo al laboratorio sul tier low e con
// reduced-motion (22 ott 2026, ora lo visita il gate qa:lab). E importato per valore riporta il
// motore nel chunk di chi lo importa (vedi loadRapier). La mappa, rapier → palco:
//   <Physics>                               → PhysicsStage
//   RigidBody                               → PhysicsBody
//   BallCollider, CuboidCollider...         → PhysicsCollider shape="ball" | "cuboid" | ...
//   MeshCollider                            → PhysicsMeshCollider
//   InstancedRigidBodies                    → PhysicsInstancedBodies
//   useRopeJoint, useSphericalJoint...      → PhysicsJoint type="rope" | "spherical" | ...
//   useRapier                               → usePhysics() (null a fisica spenta)
//   useBefore/AfterPhysicsStep, useFilter*  → PhysicsStep before | after | filter...
//   interactionGroups                       → interactionGroups di qui (stessa formula)
//   vec3, quat, euler                       → three: new Vector3().copy(body.translation())
//   joint.type() (dà Generic a tutti)       → declaredJoint(joint): tipo e parametri dichiarati
// Il Lanyard di React Bits ha la sua variante sul palco, Lanyard.tsx qui accanto.
// Ognuno prende dal contesto il modulo già caricato, e senza fisica non lo chiede: rende la posa
// ferma del markup, o niente. Gli hook di rapier li chiamano componenti che montano solo a fisica
// accesa, quindi sempre e sempre gli stessi (regole degli hook); usePhysics è l'unico hook del
// palco, e non chiama hook di rapier.
//
// La Suspense: `use` sospende finché il chunk arriva, poi <Physics> sospende ancora sull'avvio
// del WASM. Tutte e due cadono sulla Suspense della scena (Stage), quindi la scena sale intera,
// fisica compresa, come quando il motore stava nel chunk: niente Suspense qui dentro, che
// mostrerebbe i corpi fermi e poi li rimonterebbe come RigidBody (e la sonda del laboratorio
// conterebbe fotogrammi senza fisica).
export function PhysicsStage({ children, enabled, paused = false }: Props) {
  if (!enabled) return <>{children}</>
  const loaded = use(loadRapier())
  const { Physics } = loaded
  return (
    <Physics updateLoop="follow" paused={paused} gravity={[0, -9.81, 0]}>
      <Mount rapier={loaded}>{children}</Mount>
    </Physics>
  )
}

// Il primo figlio di <Physics>: qui useRapier ha sempre il suo contesto, quindi si chiama
// incondizionato, e scende col modulo a tutto il palco.
function Mount({ rapier: loaded, children }: { rapier: Rapier; children: ReactNode }) {
  const { useRapier } = loaded
  const physics = useRapier()
  const mounted = useMemo(() => ({ rapier: loaded, physics }), [loaded, physics])
  return <PhysicsMounted.Provider value={mounted}>{children}</PhysicsMounted.Provider>
}

// Il contesto del mondo di rapier (quello di useRapier: world, rapier, step...) a fisica accesa,
// null a fisica spenta. Legge il contesto che Mount ha già riempito, non chiama hook di rapier:
// si usa da qualunque componente e a qualunque tier, e chi lo usa regge il null come regge il ref
// null di PhysicsBody. Anche la strada per gli enum del motore: usePhysics()?.rapier.JointType.
export function usePhysics(): RapierContext | null {
  return useContext(PhysicsMounted)?.physics ?? null
}

// Un corpo del palco: con la fisica montata è un RigidBody (props di rapier, ref al corpo); senza
// è un gruppo fermo nella posa del markup, e le props della simulazione non servono a niente.
// Il ref resta null: chi lo usa (impulsi, letture) deve già reggere il caso «fisica spenta».
export function PhysicsBody({ children, position, rotation, quaternion, scale, ...body }: RigidBodyProps) {
  const mounted = useContext(PhysicsMounted)
  if (!mounted) {
    return (
      <group position={position} rotation={rotation} quaternion={quaternion} scale={scale}>
        {children}
      </group>
    )
  }
  const { RigidBody } = mounted.rapier
  return (
    <RigidBody position={position} rotation={rotation} quaternion={quaternion} scale={scale} {...body}>
      {children}
    </RigidBody>
  )
}

// Le forme dei collider, coi nomi che usa rapier stesso, e il componente che rende ciascuna.
const COLLIDERS = {
  ball: 'BallCollider',
  capsule: 'CapsuleCollider',
  cone: 'ConeCollider',
  convexHull: 'ConvexHullCollider',
  cuboid: 'CuboidCollider',
  cylinder: 'CylinderCollider',
  heightfield: 'HeightfieldCollider',
  roundCone: 'RoundConeCollider',
  roundCuboid: 'RoundCuboidCollider',
  roundCylinder: 'RoundCylinderCollider',
  trimesh: 'TrimeshCollider',
} as const satisfies Record<string, keyof Rapier>

type ColliderShape = keyof typeof COLLIDERS

/** `shape` più le props del collider di rapier di quella forma, `args` compresi. */
export type PhysicsColliderProps = {
  [S in ColliderShape]: { shape: S } & ComponentProps<Rapier[(typeof COLLIDERS)[S]]>
}[ColliderShape]

// Un collider esplicito. Dentro un PhysicsBody si attacca al corpo (accanto ai collider
// automatici, o da solo con colliders={false}); da solo sul palco è fermo nel mondo: un
// pavimento, una parete, un sensore. `shape` sceglie il collider di rapier, il resto sono le sue
// props: <PhysicsCollider shape="cuboid" args={[0.5, 0.1, 0.5]} position={[0, 1, 0]} />.
// Dentro un corpo eredita le sue props da collider (restitution, friction...) come quelli
// automatici, e le proprie vincono.
// Senza fisica non c'è niente da rendere: null, o i figli fermi nella posa del markup se ne ha.
// Il ref resta null, come per PhysicsBody.
export function PhysicsCollider({ shape, ...collider }: PhysicsColliderProps) {
  const mounted = useContext(PhysicsMounted)
  if (!mounted) {
    const { children, position, rotation, quaternion, scale } = collider
    if (children == null) return null
    return (
      <group position={position} rotation={rotation} quaternion={quaternion} scale={scale}>
        {children}
      </group>
    )
  }
  // le props sono quelle della forma scelta: l'unione dei tipi non lo sa, il chiamante sì
  const Collider = mounted.rapier[COLLIDERS[shape]] as ComponentType<typeof collider>
  return <Collider {...collider} />
}

// I collider automatici di rapier (MeshCollider) dalle mesh figlie, di forma `type` (ball, cuboid,
// hull, trimesh), dentro un PhysicsBody: accanto ai collider del corpo, o al posto loro con
// colliders={false}. Fuori da un corpo rapier non sa a chi attaccarli e lancia. Senza fisica i
// figli e basta, fermi dove il markup li mette.
export function PhysicsMeshCollider({ type, children }: MeshColliderProps) {
  const mounted = useContext(PhysicsMounted)
  if (!mounted) return <>{children}</>
  const { MeshCollider } = mounted.rapier
  return <MeshCollider type={type}>{children}</MeshCollider>
}

// Corpi istanziati (InstancedRigidBodies): un figlio solo, un <instancedMesh>, e un corpo per
// ognuna delle `instances`, le props di RigidBody in comune qui e quelle della singola istanza
// (position, rotation, scale...) in `instances`. Le matrici delle istanze le scrive rapier a ogni
// passo; senza fisica non le scriverebbe nessuno e le istanze starebbero tutte nell'origine, una
// sopra l'altra: le scrive InstancesAtRest, una volta, dalle pose di `instances`.
export function PhysicsInstancedBodies(props: InstancedRigidBodiesProps) {
  const mounted = useContext(PhysicsMounted)
  if (!mounted) return <InstancesAtRest {...props} />
  const { InstancedRigidBodies } = mounted.rapier
  return <InstancedRigidBodies {...props} />
}

// La stessa gerarchia di InstancedRigidBodies (un oggetto con la posa d'insieme, un involucro, la
// mesh), così le matrici stanno nello stesso spazio in cui le scrive rapier.
function InstancesAtRest({ instances, children, position, rotation, quaternion, scale }: InstancedRigidBodiesProps) {
  const wrapper = useRef<Group>(null)
  useLayoutEffect(() => {
    const mesh = wrapper.current?.children[0] as InstancedMesh | undefined
    if (!mesh?.isInstancedMesh) {
      console.warn('PhysicsInstancedBodies vuole un figlio solo, un <instancedMesh>')
      return
    }
    const matrix = new Matrix4()
    instances.forEach((instance, i) => mesh.setMatrixAt(i, restMatrix(instance, matrix)))
    mesh.instanceMatrix.needsUpdate = true
  }, [instances])
  return (
    <group position={position} rotation={rotation} quaternion={quaternion} scale={scale}>
      <group ref={wrapper}>{children}</group>
    </group>
  )
}

// La matrice di un'istanza dalla sua posa nel markup, nelle forme che R3F accetta per position,
// rotation, quaternion e scale (oggetto di three, array, o numero per i vettori).
const restPosition = new Vector3()
const restScale = new Vector3()
const restQuaternion = new Quaternion()
const restEuler = new Euler()
function restMatrix({ position, rotation, quaternion, scale }: RigidBodyProps, out: Matrix4): Matrix4 {
  const vector = (value: unknown, target: Vector3, fallback: number) => {
    if (value == null) return target.setScalar(fallback)
    if (typeof value === 'number') return target.setScalar(value)
    if (Array.isArray(value)) return target.fromArray(value)
    return target.copy(value as Vector3)
  }
  vector(position, restPosition, 0)
  vector(scale, restScale, 1)
  if (Array.isArray(quaternion)) restQuaternion.fromArray(quaternion)
  else if (quaternion) restQuaternion.copy(quaternion as Quaternion)
  else if (Array.isArray(rotation)) restQuaternion.setFromEuler(restEuler.fromArray(rotation as Parameters<Euler['fromArray']>[0]))
  else if (rotation) restQuaternion.setFromEuler(rotation as Euler)
  else restQuaternion.identity()
  return out.compose(restPosition, restQuaternion, restScale)
}

// I giunti, coi nomi dei loro hook in rapier.
const JOINTS = {
  fixed: 'useFixedJoint',
  spherical: 'useSphericalJoint',
  revolute: 'useRevoluteJoint',
  prismatic: 'usePrismaticJoint',
  rope: 'useRopeJoint',
  spring: 'useSpringJoint',
} as const satisfies Record<string, keyof Rapier>

type JointKind = keyof typeof JOINTS
type JointHook<K extends JointKind> = Rapier[(typeof JOINTS)[K]]
/** Il giunto che rapier crea per quel tipo (RopeImpulseJoint...), dai tipi di @react-three/rapier. */
type JointOf<K extends JointKind> = NonNullable<ReturnType<JointHook<K>>['current']>

/** `type` più i parametri del giunto di rapier di quel tipo, e i due corpi che lega. */
export type PhysicsJointProps = {
  [K in JointKind]: {
    type: K
    /** i due corpi: i ref di due PhysicsBody */
    body1: RefObject<RapierRigidBody | null>
    body2: RefObject<RapierRigidBody | null>
    /** come il terzo argomento dell'hook di rapier: useRopeJoint vuole [ancora1, ancora2, lunghezza] */
    params: Parameters<JointHook<K>>[2]
    /** il giunto creato, solo a fisica accesa: motori, limiti, letture */
    ref?: Ref<JointOf<K>>
  }
}[JointKind]

/** Come PhysicsJoint ha dichiarato un giunto: il tipo e i parametri dati a rapier. */
export type PhysicsJointDeclaration = PhysicsJointProps extends infer P
  ? P extends PhysicsJointProps
    ? Pick<P, 'type' | 'params'>
    : never
  : never

// Il tipo e i parametri con cui PhysicsJoint ha creato ogni giunto, per chi legge il mondo e vuole
// sapere quale limite controllare (la sonda del laboratorio): rapier non li restituisce. In
// rapier3d-compat 0.19 `joint.type()` dà 6, Generic, anche per corde e sferici (misurato il 22 ott
// 2026), e la corda non espone la sua lunghezza. La chiave è l'oggetto giunto che rapier mette
// anche nel suo world.impulseJoints.
const declarations = new WeakMap<object, PhysicsJointDeclaration>()
export function declaredJoint(joint: object): PhysicsJointDeclaration | undefined {
  return declarations.get(joint)
}

// Un giunto fra due corpi: <PhysicsJoint type="rope" body1={a} body2={b} params={[[0, 0, 0],
// [0, 0, 0], 1]} />. `type` sceglie l'hook di rapier (use<Type>Joint) e `params` sono i suoi.
// Senza fisica niente: i corpi restano nella posa del markup, e il ref resta null.
// Va DOPO i due PhysicsBody nel markup: rapier crea il giunto nel suo effetto, una volta sola,
// coi corpi che trova nei ref, e gli effetti dei fratelli girano nell'ordine del markup. Prima dei
// corpi troverebbe i ref vuoti e non creerebbe niente, in silenzio: per questo MountedJoint lo
// dice in console (e qa:lab boccia ogni errore in console). Per la stessa ragione i `params` e i
// corpi valgono al montaggio: per cambiarli si rimonta il giunto (una `key` nuova).
export function PhysicsJoint(props: PhysicsJointProps) {
  const mounted = useContext(PhysicsMounted)
  if (!mounted) return null
  // ogni tipo è un hook diverso di rapier: la chiave rimonta il giunto se il tipo cambia
  return <MountedJoint key={props.type} rapier={mounted.rapier} joint={props} />
}

// Monta solo a fisica accesa e con un tipo fisso, quindi l'hook di rapier si chiama sempre, e
// sempre lo stesso.
function MountedJoint({ rapier: loaded, joint }: { rapier: Rapier; joint: PhysicsJointProps }) {
  const { type, body1, body2, params, ref } = joint
  // la firma comune degli hook dei giunti: l'unione dei tipi non sa che `params` è della forma di
  // `type`, il chiamante sì
  const useJoint = loaded[JOINTS[type]] as unknown as (
    body1: RefObject<RapierRigidBody | null>,
    body2: RefObject<RapierRigidBody | null>,
    params: PhysicsJointProps['params'],
  ) => RefObject<JointOf<JointKind> | undefined>
  const created = useJoint(body1, body2, params)
  useEffect(() => {
    // l'effetto di rapier, dichiarato prima di questo, ha già provato a creare il giunto
    const made = created.current
    if (!made) {
      console.error(
        `PhysicsJoint ${type}: nessun giunto, i corpi non c'erano ancora. Va dopo i due PhysicsBody nel markup, con i loro ref.`,
      )
      return
    }
    declarations.set(made, { type, params } as PhysicsJointDeclaration)
    const emptyRef = fillRef(ref as Ref<typeof made> | undefined, made)
    return () => {
      declarations.delete(made)
      emptyRef?.()
    }
    // i parametri valgono al montaggio, come per rapier: la dichiarazione è quella di allora
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [created, ref, type])
  return null
}

// Il ref del chiamante, riempito come lo riempirebbe React; la funzione restituita lo svuota.
function fillRef<T>(ref: Ref<T> | undefined, value: T): (() => void) | undefined {
  if (!ref) return undefined
  if (typeof ref === 'function') {
    const cleanup = ref(value)
    return () => (typeof cleanup === 'function' ? cleanup() : ref(null))
  }
  ref.current = value
  return () => {
    ref.current = null
  }
}

type FilterContactPair = Parameters<Rapier['useFilterContactPair']>[0]
type FilterIntersectionPair = Parameters<Rapier['useFilterIntersectionPair']>[0]

export interface PhysicsStepProps {
  /** prima di ogni passo del mondo: forze, impulsi, corpi cinematici */
  before?: WorldStepCallback
  /** dopo ogni passo: letture di posizioni, contatti, giunti */
  after?: WorldStepCallback
  /** come useFilterContactPair: solo per i collider con ActiveHooks.FILTER_CONTACT_PAIR */
  filterContactPair?: FilterContactPair
  /** come useFilterIntersectionPair: solo per i collider con ActiveHooks.FILTER_INTERSECTION_PAIR */
  filterIntersectionPair?: FilterIntersectionPair
}

// Le callback dentro il passo del mondo (useBeforePhysicsStep, useAfterPhysicsStep e i due filtri
// di rapier): <PhysicsStep after={(world) => ...} />. Senza fisica nessun passo, quindi nessuna
// callback. Ogni prop presente monta il suo hook, e toglierla lo smonta: niente registrazioni a
// vuoto per le prop che mancano.
export function PhysicsStep({ before, after, filterContactPair, filterIntersectionPair }: PhysicsStepProps) {
  const mounted = useContext(PhysicsMounted)
  if (!mounted) return null
  const { useBeforePhysicsStep, useAfterPhysicsStep, useFilterContactPair, useFilterIntersectionPair } = mounted.rapier
  return (
    <>
      {before && <StepHook key="before" useHook={useBeforePhysicsStep} callback={before} />}
      {after && <StepHook key="after" useHook={useAfterPhysicsStep} callback={after} />}
      {filterContactPair && <StepHook key="contact" useHook={useFilterContactPair} callback={filterContactPair} />}
      {filterIntersectionPair && (
        <StepHook key="intersection" useHook={useFilterIntersectionPair} callback={filterIntersectionPair} />
      )}
    </>
  )
}

// Un hook di rapier per istanza, sempre lo stesso: la chiave lo lega alla prop di PhysicsStep.
function StepHook<C>({ useHook, callback }: { useHook: (callback: C) => void; callback: C }) {
  useHook(callback)
  return null
}

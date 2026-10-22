import { createContext, use, useContext, type ComponentProps, type ComponentType, type ReactNode } from 'react'
// SOLO tipi (vedi loadRapier)
import type { RigidBodyProps } from '@react-three/rapier'

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
// Vale per ogni file: un import di VALORE da @react-three/rapier (un collider, useRapier)
// rimette il motore nel chunk di chi lo importa, a qualunque tier. I tipi sono liberi; il resto
// passa da qui, con PhysicsBody e PhysicsCollider. perf:check lo boccia sul manifest, anche in
// un file del progetto caricato solo a fisica accesa: dalla build non si legge a che tier si
// carica un chunk.
let rapier: Promise<Rapier> | undefined
const loadRapier = () => (rapier ??= import('@react-three/rapier'))

// Il modulo caricato, solo sotto un <Physics> montato da PhysicsStage; null altrove. PhysicsBody
// e PhysicsCollider lo leggono per scegliere fra rapier e la scena ferma. Il modulo intero, non i
// soli componenti che servono oggi: quello che manca si aggiunge senza toccare il palco.
const PhysicsMounted = createContext<Rapier | null>(null)

// Il palco fisico della ROADMAP NEXT: rapier steppato DENTRO il frame R3F (updateLoop
// "independent" userebbe un suo clock — qui il loop è uno solo, regola 3). Regola dura: rapier è
// l'UNICO owner dei transform dei suoi RigidBody — mai anche damparli a mano (double-owner =
// jitter, ed è il primo check dell'auditor). Semantica reduced-motion scelta kit-wide (era un
// open question della R&D): con enabled=false la fisica NON monta e i figli restano dove il
// markup li mette — scena ferma, niente sim che «gira ma ignora gli impulsi».
//
// Il patto coi figli: i corpi si scrivono con PhysicsBody e i collider con PhysicsCollider, MAI
// coi componenti di rapier. Un RigidBody (e ogni hook o collider di rapier) senza <Physics> sopra
// lancia «useRapier must be used within <Physics />!» e la tela cade sul poster: è successo al
// laboratorio sul tier low e con reduced-motion (22 ott 2026, ora lo visita il gate qa:lab). E
// importato per valore riporta il motore nel chunk di chi lo importa (vedi loadRapier). Quello
// che qui non c'è ancora (giunti, useRapier, InstancedRigidBodies) si aggiunge qui, sul modello
// di PhysicsCollider: prende dal contesto il modulo già caricato, e senza fisica non lo chiede.
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
      <PhysicsMounted.Provider value={loaded}>{children}</PhysicsMounted.Provider>
    </Physics>
  )
}

// Un corpo del palco: con la fisica montata è un RigidBody (props di rapier, ref al corpo); senza
// è un gruppo fermo nella posa del markup, e le props della simulazione non servono a niente.
// Il ref resta null: chi lo usa (impulsi, letture) deve già reggere il caso «fisica spenta».
export function PhysicsBody({ children, position, rotation, quaternion, scale, ...body }: RigidBodyProps) {
  const rapier = useContext(PhysicsMounted)
  if (!rapier) {
    return (
      <group position={position} rotation={rotation} quaternion={quaternion} scale={scale}>
        {children}
      </group>
    )
  }
  const { RigidBody } = rapier
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
  const rapier = useContext(PhysicsMounted)
  if (!rapier) {
    const { children, position, rotation, quaternion, scale } = collider
    if (children == null) return null
    return (
      <group position={position} rotation={rotation} quaternion={quaternion} scale={scale}>
        {children}
      </group>
    )
  }
  // le props sono quelle della forma scelta: l'unione dei tipi non lo sa, il chiamante sì
  const Collider = rapier[COLLIDERS[shape]] as ComponentType<typeof collider>
  return <Collider {...collider} />
}

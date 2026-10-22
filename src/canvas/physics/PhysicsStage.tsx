import { createContext, use, useContext, type ReactNode } from 'react'
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
// passa da qui, o sta in un file che si carica solo a fisica accesa.
let rapier: Promise<Rapier> | undefined
const loadRapier = () => (rapier ??= import('@react-three/rapier'))

// Il RigidBody del modulo caricato, solo sotto un <Physics> montato da PhysicsStage; null
// altrove. PhysicsBody lo legge per scegliere fra corpo e gruppo fermo.
const PhysicsMounted = createContext<Rapier['RigidBody'] | null>(null)

// Il palco fisico della ROADMAP NEXT: rapier steppato DENTRO il frame R3F (updateLoop
// "independent" userebbe un suo clock — qui il loop è uno solo, regola 3). Regola dura: rapier è
// l'UNICO owner dei transform dei suoi RigidBody — mai anche damparli a mano (double-owner =
// jitter, ed è il primo check dell'auditor). Semantica reduced-motion scelta kit-wide (era un
// open question della R&D): con enabled=false la fisica NON monta e i figli restano dove il
// markup li mette — scena ferma, niente sim che «gira ma ignora gli impulsi».
//
// Il patto coi figli: i corpi si scrivono con PhysicsBody, MAI con <RigidBody> di rapier. Un
// RigidBody (e ogni hook o collider di rapier) senza <Physics> sopra lancia «useRapier must be
// used within <Physics />!» e la tela cade sul poster: è successo al laboratorio sul tier low e
// con reduced-motion (22 ott 2026, ora lo visita il gate qa:lab). Quello che non è un corpo e
// usa rapier va dietro `enabled` anche nel chiamante.
//
// La Suspense: `use` sospende finché il chunk arriva, poi <Physics> sospende ancora sull'avvio
// del WASM. Tutte e due cadono sulla Suspense della scena (Stage), quindi la scena sale intera,
// fisica compresa, come quando il motore stava nel chunk: niente Suspense qui dentro, che
// mostrerebbe i corpi fermi e poi li rimonterebbe come RigidBody (e la sonda del laboratorio
// conterebbe fotogrammi senza fisica).
export function PhysicsStage({ children, enabled, paused = false }: Props) {
  if (!enabled) return <>{children}</>
  const { Physics, RigidBody } = use(loadRapier())
  return (
    <Physics updateLoop="follow" paused={paused} gravity={[0, -9.81, 0]}>
      <PhysicsMounted.Provider value={RigidBody}>{children}</PhysicsMounted.Provider>
    </Physics>
  )
}

// Un corpo del palco: con la fisica montata è un RigidBody (props di rapier, ref al corpo); senza
// è un gruppo fermo nella posa del markup, e le props della simulazione non servono a niente.
// Il ref resta null: chi lo usa (impulsi, letture) deve già reggere il caso «fisica spenta».
export function PhysicsBody({ children, position, rotation, quaternion, scale, ...body }: RigidBodyProps) {
  const RigidBody = useContext(PhysicsMounted)
  if (!RigidBody) {
    return (
      <group position={position} rotation={rotation} quaternion={quaternion} scale={scale}>
        {children}
      </group>
    )
  }
  return (
    <RigidBody position={position} rotation={rotation} quaternion={quaternion} scale={scale} {...body}>
      {children}
    </RigidBody>
  )
}

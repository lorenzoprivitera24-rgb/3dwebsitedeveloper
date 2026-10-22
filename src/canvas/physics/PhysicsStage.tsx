import { createContext, useContext, type ReactNode } from 'react'
import { Physics, RigidBody, type RigidBodyProps } from '@react-three/rapier'

interface Props {
  children: ReactNode
  /** Dal tier (physicsEnabled) E dal ramo reduced: false = i figli renderizzano SENZA fisica. */
  enabled: boolean
  /** true in sezioni non pinnate dove la sim può dormire fuori viewport. */
  paused?: boolean
}

// true solo sotto un <Physics> montato da PhysicsStage: PhysicsBody lo legge per scegliere.
const PhysicsMounted = createContext(false)

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
export function PhysicsStage({ children, enabled, paused = false }: Props) {
  if (!enabled) return <>{children}</>
  return (
    <Physics updateLoop="follow" paused={paused} gravity={[0, -9.81, 0]}>
      <PhysicsMounted.Provider value={true}>{children}</PhysicsMounted.Provider>
    </Physics>
  )
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
  return (
    <RigidBody position={position} rotation={rotation} quaternion={quaternion} scale={scale} {...body}>
      {children}
    </RigidBody>
  )
}

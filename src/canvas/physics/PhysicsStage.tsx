import type { ReactNode } from 'react'
import { Physics } from '@react-three/rapier'

interface Props {
  children: ReactNode
  /** Dal tier (physicsEnabled) E dal ramo reduced: false = i figli renderizzano SENZA fisica. */
  enabled: boolean
  /** true in sezioni non pinnate dove la sim può dormire fuori viewport. */
  paused?: boolean
}

// Il palco fisico della ROADMAP NEXT: rapier steppato DENTRO il frame R3F (updateLoop
// "independent" userebbe un suo clock — qui il loop è uno solo, regola 3). Regola dura: rapier è
// l'UNICO owner dei transform dei suoi RigidBody — mai anche damparli a mano (double-owner =
// jitter, ed è il primo check dell'auditor). Semantica reduced-motion scelta kit-wide (era un
// open question della R&D): con enabled=false la fisica NON monta e i figli restano dove il
// markup li mette — scena ferma, niente sim che «gira ma ignora gli impulsi».
export function PhysicsStage({ children, enabled, paused = false }: Props) {
  if (!enabled) return <>{children}</>
  return (
    <Physics updateLoop="follow" paused={paused} gravity={[0, -9.81, 0]}>
      {children}
    </Physics>
  )
}

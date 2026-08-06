import { useEffect } from 'react'
import { useProgress } from '@react-three/drei'
import { publishCanvasMounted, publishLoadProgress, publishLoading } from '../lib/loadProgress'

// Publishes drei's real asset progress (it hooks three's DefaultLoadingManager: HDRI, GLB,
// textures) into the dependency-free store the DOM preloader reads.
//
// This component belongs to the CANVAS chunk on purpose — it is the only place allowed to import
// drei for progress. It is mounted as a SIBLING of <Stage>, i.e. outside Stage's error boundary,
// so a renderer crash swaps in the poster without freezing the preloader at its last value.
export function LoadProgressBridge() {
  const { progress, active } = useProgress()

  useEffect(() => {
    publishCanvasMounted()
  }, [])

  useEffect(() => {
    publishLoadProgress(progress)
  }, [progress])

  useEffect(() => {
    publishLoading(active)
  }, [active])

  return null
}

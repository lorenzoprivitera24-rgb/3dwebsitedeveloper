import { useThree } from '@react-three/fiber'

// La cucitura di feature-gate WebGPU/WebGL2 (ROADMAP NEXT). Correzione verificata: dopo il
// fallback automatico `renderer.isWebGPURenderer` resta true — l'unica fonte di verità è
// `renderer.backend.isWebGPUBackend`. Da usare per gare compute/indirect-draw e per scegliere
// il ramo di post-processing; NON per il tier (quello guarda la macchina, non il backend).
// Hook da dentro il Canvas (usa useThree).
export function useRenderBackend(): 'webgpu' | 'webgl2' {
  const gl = useThree((s) => s.gl)
  const backend = (gl as unknown as { backend?: { isWebGPUBackend?: boolean } }).backend
  return backend?.isWebGPUBackend ? 'webgpu' : 'webgl2'
}

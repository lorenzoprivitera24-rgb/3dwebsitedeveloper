// KTX2 on the WebGPU path — use THREE'S OWN KTX2Loader, not drei's useKTX2 wrapper.
//
// Verified constraints (see ROADMAP "NOW" + photoreal dossier):
// - drei's useKTX2 is a thin wrapper whose support detection assumes the WebGL renderer;
//   three's loader detects WebGPU correctly, but detectSupport(renderer) MUST run after
//   `await renderer.init()`. R3F's async `gl` factory guarantees init has completed by the
//   time any hook below runs.
// - The transcoder is self-hosted in /public/basis (GDPR: no third-party CDN at runtime).
//   Re-copy it from node_modules/three/examples/jsm/libs/basis after a `three` major bump.
import { useLoader, useThree } from '@react-three/fiber'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import type { Texture, WebGLRenderer } from 'three'

const TRANSCODER_PATH = '/basis/'

let shared: KTX2Loader | null = null

/**
 * Shared, renderer-aware KTX2 loader for imperative use (e.g. inside GLTFLoader wiring:
 * `gltfLoader.setKTX2Loader(getKTX2Loader(renderer))`).
 * `renderer` is the initialized WebGPURenderer (or WebGL2 fallback) from R3F state.
 */
export function getKTX2Loader(renderer: unknown): KTX2Loader {
  if (!shared) shared = new KTX2Loader().setTranscoderPath(TRANSCODER_PATH)
  // Works for both backends in three r18x; typings still say WebGLRenderer.
  shared.detectSupport(renderer as WebGLRenderer)
  return shared
}

/** Load a single .ktx2 texture through the shared transcoder (suspends via useLoader). */
export function useKTX2Texture(url: string): Texture {
  const renderer = useThree((s) => s.gl)
  return useLoader(KTX2Loader, url, (loader) => {
    loader.setTranscoderPath(TRANSCODER_PATH)
    loader.detectSupport(renderer as unknown as WebGLRenderer)
  })
}

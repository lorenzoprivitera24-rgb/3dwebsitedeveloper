import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Note: StrictMode double-mounts effects in development. Our effects (event listeners, fog
// install, sim driver) all clean up on unmount, so the double-mount is safe; a doubled init seen
// only in dev is StrictMode, not a leak.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

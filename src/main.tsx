import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

// Note: StrictMode double-mounts in development. useGSAP and ReactLenis handle their own cleanup,
// so this is fine; if you ever see a doubled init only in dev, StrictMode is the reason.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

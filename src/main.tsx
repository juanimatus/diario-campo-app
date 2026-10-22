import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import '@fontsource/barlow/latin-400.css'
import '@fontsource/barlow/latin-600.css'
import '@fontsource/barlow/latin-700.css'
import '@fontsource/barlow-condensed/latin-600.css'
import '@fontsource/barlow-condensed/latin-700.css'
import App from './App'
import { iniciarSincronizacion } from './sync'
import './styles.css'

registerSW({ immediate: true })
navigator.storage?.persist?.()
iniciarSincronizacion()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

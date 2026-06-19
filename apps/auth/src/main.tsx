import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AuthApp } from './screens/AuthApp'
import './styles.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <AuthApp />
  </StrictMode>
)

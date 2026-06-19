import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AssetsApp } from './screens/AssetsApp'
import './styles.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <AssetsApp />
  </StrictMode>
)

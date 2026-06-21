import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

import { AppRoutes } from './routes'
import './styles.css'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <OverlayScrollbarsComponent
      style={{ height: '100vh', width: '100vw' }}
      options={{
        scrollbars: {
          autoHide: 'scroll',
          theme: 'os-theme-dark',
        },
      }}
      defer
    >
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </OverlayScrollbarsComponent>
  </StrictMode>
)

import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

import { AppRoutes } from './routes'
import './styles.css'

// shadcn/ui — always dark mode
document.documentElement.classList.add('dark')

createRoot(document.getElementById('root') as HTMLElement).render(
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
)

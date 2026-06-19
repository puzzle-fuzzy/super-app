import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

import { WorkspaceApp } from './screens/WorkspaceApp'
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
      <WorkspaceApp />
    </OverlayScrollbarsComponent>
  </StrictMode>
)

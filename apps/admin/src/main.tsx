import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'
import 'overlayscrollbars/overlayscrollbars.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AdminDashboard } from './screens/dashboard'
import './styles.css'

function AdminApp() {
  return (
    <OverlayScrollbarsComponent
      options={{ scrollbars: { autoHide: 'scroll', theme: 'os-theme-dark' } }}
      style={{ height: '100vh' }}
    >
      <main className="min-h-screen bg-[#141414] text-[#e5e5e5]">
        <section
          className="mx-auto w-full max-w-[1800px] px-8 py-8 pb-16
            max-[920px]:px-[18px] max-[920px]:py-6
            max-[620px]:px-3.5 max-[620px]:py-5"
        >
          <AdminDashboard />
        </section>
      </main>
    </OverlayScrollbarsComponent>
  )
}

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  )
}

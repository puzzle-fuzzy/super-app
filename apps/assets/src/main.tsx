import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react'

import { useRequireAuth } from '@super-app/auth-client/react'

import { AssetsApp } from './screens/AssetsApp'
import './styles.css'

function AssetsEntry() {
  const { user, isLoading, error } = useRequireAuth()

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#141414] p-6">
        <div className="w-full max-w-[560px] rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
          <p className="m-0 mb-2.5 text-xs font-bold tracking-[0.16em] text-[#666666]">
            SUPER ASSETS
          </p>
          <h1 className="m-0 mb-3 text-[34px] font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
            正在确认登录状态
          </h1>
          <p className="m-0 text-[#999999]">Super 正在连接资产中心。</p>
        </div>
      </main>
    )
  }

  if (error || !user) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#141414] p-6">
        <div className="w-full max-w-[560px] rounded-[24px] border border-[#2a2a2a] bg-[#1c1c1c] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.24)]">
          <p className="m-0 mb-2.5 text-xs font-bold tracking-[0.16em] text-[#666666]">
            SUPER ASSETS
          </p>
          <h1 className="m-0 mb-3 text-[34px] font-bold leading-tight tracking-[-0.02em] text-[#e5e5e5]">
            需要登录
          </h1>
          <p className="m-0 text-[#999999]">正在跳转到统一登录中心。</p>
        </div>
      </main>
    )
  }

  return <AssetsApp user={user} />
}

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
      <AssetsEntry />
    </OverlayScrollbarsComponent>
  </StrictMode>
)

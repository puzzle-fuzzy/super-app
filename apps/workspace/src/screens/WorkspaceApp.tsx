import { clientEnv } from '@super-app/env/client'
import { logout } from '@super-app/auth-client'
import { useRequireAuth } from '@super-app/auth-client/react'

interface Shortcut {
  label: string
  description: string
  href: string
  status: string
}

export function WorkspaceApp() {
  const { user, isLoading, error } = useRequireAuth()

  if (isLoading) {
    return <ScreenState title="正在确认登录状态" description="Super 正在连接你的云端工作区。" />
  }

  if (error || !user) {
    return <ScreenState title="需要登录" description="正在跳转到统一登录中心。" />
  }

  const shortcuts: Shortcut[] = [
    {
      label: '资产库',
      description: '上传、预览和管理图片、视频、文档等素材。',
      href: clientEnv.SUPER_PUBLIC_ASSETS_APP_URL,
      status: 'MVP NEXT',
    },
    {
      label: '画布',
      description: '创建项目，把资产拖入画布并保存云端文档。',
      href: clientEnv.SUPER_PUBLIC_CANVAS_APP_URL,
      status: 'PLANNED',
    },
    {
      label: '传输',
      description: 'P2P 文本与文件传输，完成后可保存到资产中心。',
      href: clientEnv.SUPER_PUBLIC_TRANSFER_APP_URL,
      status: 'LATER',
    },
    {
      label: 'API 控制台',
      description: '管理 API Key、额度、调用记录和后续模型能力。',
      href: clientEnv.SUPER_PUBLIC_CONSOLE_APP_URL,
      status: 'LATER',
    },
  ]

  async function handleLogout() {
    await logout()
    window.location.assign(clientEnv.SUPER_PUBLIC_AUTH_APP_URL)
  }

  return (
    <main className="workspace-page bg-background text-foreground">
      <aside className="sidebar" aria-label="Workspace navigation">
        <div className="sidebar-brand">
          <span>S</span>
          <strong>Super</strong>
        </div>
        <nav>
          <a aria-current="page" href={clientEnv.SUPER_PUBLIC_WORKSPACE_APP_URL}>
            工作台
          </a>
          <a href={clientEnv.SUPER_PUBLIC_ASSETS_APP_URL}>资产库</a>
          <a href={clientEnv.SUPER_PUBLIC_CANVAS_APP_URL}>画布</a>
          <a href={clientEnv.SUPER_PUBLIC_CONSOLE_APP_URL}>API</a>
        </nav>
      </aside>

      <section className="workspace-main">
        <header className="topbar">
          <div>
            <p className="eyebrow">CLOUD WORKSPACE</p>
            <h1>欢迎回来，{user.name || user.email}</h1>
          </div>
          <button type="button" onClick={handleLogout}>
            退出登录
          </button>
        </header>

        <section className="hero-band">
          <div>
            <p className="hero-kicker">MVP FLOW</p>
            <h2>从这里进入资产、画布和 API 能力。</h2>
          </div>
          <p>
            当前工作台先承载统一入口和登录态验证。下一步会接入最近资产、最近画布项目和使用额度。
          </p>
        </section>

        <section className="shortcut-grid" aria-label="Workspace shortcuts">
          {shortcuts.map((shortcut) => (
            <a className="shortcut-card" key={shortcut.label} href={shortcut.href}>
              <span>{shortcut.status}</span>
              <h3>{shortcut.label}</h3>
              <p>{shortcut.description}</p>
            </a>
          ))}
        </section>

        <section className="empty-row">
          <div>
            <p className="section-label">最近项目</p>
            <h3>还没有画布项目</h3>
            <p>创建第一个画布后，它会出现在这里。</p>
          </div>
          <div>
            <p className="section-label">最近资产</p>
            <h3>资产库等待接入</h3>
            <p>上传图片或文件后，工作台会展示最近使用的素材。</p>
          </div>
        </section>
      </section>
    </main>
  )
}

function ScreenState({ title, description }: { title: string; description: string }) {
  return (
    <main className="state-screen">
      <div>
        <p className="eyebrow">SUPER WORKSPACE</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </main>
  )
}

import React from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

import { RoseLoader } from '@super-app/ui-react'

import { ShellLayout } from './components/ShellLayout'
import { useShell, useShellUser } from './components/ShellContext'
import { AuthApp } from './screens/AuthApp'

// Lazy-load each app screen — keeps per-module bundle sizes small
const WorkspaceApp = React.lazy(() =>
  import('./screens/WorkspaceApp').then((m) => ({ default: m.WorkspaceApp }))
)
const AssetsApp = React.lazy(() =>
  import('./screens/AssetsApp').then((m) => ({ default: m.AssetsApp }))
)
const CanvasApp = React.lazy(() =>
  import('./screens/CanvasApp').then((m) => ({ default: m.CanvasApp }))
)
const ConsoleAppContent = React.lazy(() =>
  import('./screens/ConsoleApp').then((m) => ({ default: m.ConsoleAppContent }))
)
const TransferApp = React.lazy(() =>
  import('./screens/TransferApp').then((m) => ({ default: m.TransferApp }))
)
const AdminApp = React.lazy(() =>
  import('./screens/AdminApp').then((m) => ({ default: m.AdminApp }))
)

function AppFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#141414]">
      <RoseLoader />
    </div>
  )
}

/** 从 ShellContext 取 user 然后传给 app 组件的包装器 */
function WorkspaceRoute() {
  const user = useShellUser()
  return (
    <React.Suspense fallback={<AppFallback />}>
      <WorkspaceApp user={user} />
    </React.Suspense>
  )
}

function AssetsRoute() {
  const user = useShellUser()
  return (
    <React.Suspense fallback={<AppFallback />}>
      <AssetsApp user={user} />
    </React.Suspense>
  )
}

function CanvasRoute() {
  const user = useShellUser()
  return (
    <React.Suspense fallback={<AppFallback />}>
      <CanvasApp user={user} />
    </React.Suspense>
  )
}

function ConsoleRoute() {
  const user = useShellUser()
  return (
    <React.Suspense fallback={<AppFallback />}>
      <ConsoleAppContent user={user} />
    </React.Suspense>
  )
}

function TransferRoute() {
  const { user } = useShell()
  return (
    <React.Suspense fallback={<AppFallback />}>
      <TransferApp user={user} />
    </React.Suspense>
  )
}

function AdminRoute() {
  return (
    <React.Suspense fallback={<AppFallback />}>
      <AdminApp />
    </React.Suspense>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      {/* 公开路由：无需登录 */}
      <Route path="/auth/*" element={<AuthApp />} />

      {/* 认证路由：需要登录 */}
      <Route element={<ShellLayout />}>
        <Route path="/workspace/*" element={<WorkspaceRoute />} />
        <Route path="/assets/*" element={<AssetsRoute />} />
        <Route path="/canvas/*" element={<CanvasRoute />} />
        <Route path="/api-console/*" element={<ConsoleRoute />} />
        <Route path="/transfer/*" element={<TransferRoute />} />
        <Route path="/admin/*" element={<AdminRoute />} />
        {/* 默认跳转到工作台 */}
        <Route path="*" element={<Navigate to="/workspace" replace />} />
      </Route>
    </Routes>
  )
}

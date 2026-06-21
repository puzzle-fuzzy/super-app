import { Navigate, Route, Routes } from 'react-router-dom'
import { CanvasProjectList } from '@/components/canvas/CanvasProjectList'

/**
 * 画布应用路由 — tersa 风格简化版
 */
export function CanvasApp({ user }: { user: { id: string; name?: string; email: string } }) {
  return (
    <Routes>
      <Route path="/" element={<CanvasProjectList user={user} />} />
      <Route path="*" element={<Navigate to="/canvas" replace />} />
    </Routes>
  )
}

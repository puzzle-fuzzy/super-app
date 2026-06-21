import type { ConnectionLineComponent } from '@xyflow/react'

const HALF = 0.5

/**
 * 自定义拖拽连线预览 — 贝塞尔曲线 + 末端圆点
 * 与 tersa 的 Connection 组件完全一致
 */
export const ConnectionLine: ConnectionLineComponent = ({ fromX, fromY, toX, toY }) => (
  <g>
    <path
      className="animated"
      d={`M${fromX},${fromY} C ${fromX + (toX - fromX) * HALF},${fromY} ${fromX + (toX - fromX) * HALF},${toY} ${toX},${toY}`}
      fill="none"
      stroke="#3a3a3a"
      strokeWidth={1.5}
    />
    <circle cx={toX} cy={toY} fill="#e5e5e5" r={3} stroke="#3a3a3a" strokeWidth={1} />
  </g>
)

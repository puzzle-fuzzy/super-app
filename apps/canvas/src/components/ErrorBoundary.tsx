import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  level?: 'app' | 'node'
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.level === 'app') {
        return (
          <div style={{ display: 'grid', placeItems: 'center', height: '100vh', background: '#141414', color: '#e5e5e5' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>抱歉，发生了意外错误</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: '8px 20px',
                  border: '1px solid #3a3a3a',
                  borderRadius: 8,
                  background: '#1c1c1c',
                  color: '#e5e5e5',
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                刷新页面
              </button>
            </div>
          </div>
        )
      }
      // node-level fallback
      return (
        <div
          style={{
            width: 320,
            padding: 12,
            background: '#1c1c1c',
            border: '1px solid #3a3a3a',
            borderRadius: 12,
            color: '#999999',
            fontSize: 13,
          }}
        >
          节点渲染错误
        </div>
      )
    }
    return this.props.children
  }
}

import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

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
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              height: '100vh',
              background: '#141414',
              color: '#e5e5e5',
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>抱歉，发生了意外错误</p>
              <Button
                variant="ghost"
                className="h-10 rounded-[10px] px-5 text-[13px] font-medium"
                onClick={() => window.location.reload()}
              >
                刷新页面
              </Button>
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

import { Component, type ReactNode } from 'react'

interface Props {
  level: 'app' | 'node'
  children: ReactNode
}

interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.level === 'app') {
        return (
          <div className="flex min-h-screen items-center justify-center bg-[#141414]">
            <div className="rounded-2xl border border-[#2a2a2a] bg-[#1c1c1c] px-8 py-6 text-center">
              <h2 className="m-0 text-lg font-semibold text-[#e5e5e5]">发生错误</h2>
              <p className="mt-2 text-[13px] text-[#999999]">请刷新页面重试</p>
            </div>
          </div>
        )
      }
      return (
        <div className="rounded-2xl border border-[#5a2a27] bg-[#2a1d1b] px-4 py-3 text-[13px] text-[#ffaaa3]">
          节点渲染错误
        </div>
      )
    }
    return this.props.children
  }
}

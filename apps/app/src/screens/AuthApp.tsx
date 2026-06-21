import { FormEvent, useMemo, useState } from 'react'

import { clientEnv } from '@super-app/env/client'
import { login, register } from '@super-app/auth-client'

type Mode = 'login' | 'register'

interface FormState {
  email: string
  password: string
  name: string
}

const initialState: FormState = {
  email: '',
  password: '',
  name: '',
}

export function AuthApp() {
  const [mode, setMode] = useState<Mode>('login')
  const [form, setForm] = useState<FormState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const returnTo = useMemo(() => getReturnTo(), [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (mode === 'login') {
        await login({
          email: form.email,
          password: form.password,
          returnTo,
        })
      } else {
        await register({
          email: form.email,
          password: form.password,
          name: form.name || undefined,
          returnTo,
        })
      }

      window.location.assign(returnTo ?? clientEnv.SUPER_PUBLIC_WORKSPACE_APP_URL)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '认证请求失败')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="auth-shell">
        <section className="auth-copy" aria-label="Super workspace intro">
          <div className="brand-mark">S</div>
          <p className="eyebrow">SUPER CLOUD WORKSPACE</p>
          <h1>一次登录，进入你的统一创作工作区。</h1>
          <p className="lede">
            资产、画布、传输、API 能力和云端项目从这里开始连接。登录后会回到你刚才打开的应用。
          </p>
          <div className="signal-grid" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </div>
        </section>

        <section className="auth-panel" aria-label="Authentication form">
          <div className="mode-switch" role="tablist" aria-label="Auth mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'active' : ''}
              onClick={() => setMode('login')}
            >
              登录
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
            >
              注册
            </button>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div>
              <p className="form-title">{mode === 'login' ? '欢迎回来' : '创建 Super 账号'}</p>
              <p className="form-subtitle">
                {mode === 'login' ? '继续访问你的项目和资产。' : '第一阶段账号用于云端工作区。'}
              </p>
            </div>

            {mode === 'register' ? (
              <label>
                <span>名称</span>
                <input
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="你的名字"
                />
              </label>
            ) : null}

            <label>
              <span>邮箱</span>
              <input
                required
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="you@super.yxswy.com"
              />
            </label>

            <label>
              <span>密码</span>
              <input
                required
                minLength={mode === 'register' ? 8 : 1}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder={mode === 'login' ? '输入密码' : '至少 8 位'}
              />
            </label>

            {error ? <p className="form-error">{error}</p> : null}

            <button type="submit" className="submit-button" disabled={isSubmitting}>
              {isSubmitting ? '处理中...' : mode === 'login' ? '登录 Super' : '创建并进入'}
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}

function getReturnTo() {
  const params = new URLSearchParams(window.location.search)
  const value = params.get('return_to')

  if (!value) {
    return undefined
  }

  if (value.startsWith('/') && !value.startsWith('//')) {
    return value
  }

  try {
    const url = new URL(value)
    return url.toString()
  } catch {
    return undefined
  }
}

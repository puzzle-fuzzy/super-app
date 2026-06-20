/**
 * 邮件发送服务 — SMTP（Nodemailer）+ 开发环境 console fallback。
 *
 * 配置方式（.env）：
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
 * 任一缺失则 fallback 到 console.log（dev 模式不阻塞）。
 */
let _transporter: unknown = null

async function getTransporter() {
  if (_transporter) return _transporter as { sendMail: (opts: Record<string, unknown>) => Promise<unknown> }

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM

  if (!host || !user || !pass || !from) {
    return null
  }

  try {
    const nodemailer = await import('nodemailer')
    const port = parseInt(process.env.SMTP_PORT || '587', 10)
    _transporter = nodemailer.default.createTransport({ host, port, auth: { user, pass } })
    return _transporter as { sendMail: (opts: Record<string, unknown>) => Promise<unknown> }
  } catch {
    console.warn('[email] nodemailer 不可用，邮件将降级为 console.log')
    return null
  }
}

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM

  if (!host || !user || !pass || !from) return null
  return { host, port: parseInt(process.env.SMTP_PORT || '587', 10), user, pass, from }
}

/**
 * 发送密码重置邮件。
 * SMTP 不可用时降级为 console.log（dev 模式链接可见）。
 */
export async function sendPasswordResetEmail(email: string, resetLink: string) {
  const smtp = getSmtpConfig()
  const subject = '【Super】密码重置'
  const text = `请点击以下链接重置密码（链接 30 分钟内有效）：\n\n${resetLink}\n\n如果未请求重置，请忽略此邮件。`

  if (smtp) {
    try {
      const transporter = await getTransporter()
      if (transporter) {
        await transporter.sendMail({
          from: smtp.from,
          to: email,
          subject,
          text,
        })
        return
      }
    } catch (err) {
      console.error('[email] SMTP 发送失败，降级为 console.log:', err)
    }
  }

  // Dev fallback
  console.log(`[DEV] 密码重置邮件 → ${email}`)
  console.log(`[DEV] 主题: ${subject}`)
  console.log(`[DEV] 内容:\n${text}`)
  console.log(`[DEV] Reset link: ${resetLink}`)
}

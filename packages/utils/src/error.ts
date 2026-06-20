const DEFAULT_MAX_ERROR_MESSAGE_LENGTH = 500

export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  return String(err)
}

export function sanitizeErrorMessage(
  message: string,
  maxLength: number = DEFAULT_MAX_ERROR_MESSAGE_LENGTH
): string {
  let sanitized = message.length > maxLength ? `${message.slice(0, maxLength)}…` : message

  sanitized = sanitized.replace(/"prompt"\s*:\s*"[^"]{50,}"/gi, '"prompt":"[REDACTED]"')
  sanitized = sanitized.replace(/"input"\s*:\s*\{[^}]{50,}\}/gi, '"input":"[REDACTED]"')

  return sanitized
}

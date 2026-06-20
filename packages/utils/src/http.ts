export function sanitizeDownloadFileName(name: string, fallback = 'download'): string {
  const sanitized = replaceHeaderUnsafeChars(name.trim())
  return sanitized || fallback
}

export function buildContentDisposition(fileName: string): string {
  const sanitized = sanitizeDownloadFileName(fileName)
  const asciiFallback = Array.from(sanitized, char => isAsciiFallbackSafeChar(char) ? char : '_').join('')
  const encoded = encodeURIComponent(sanitized)

  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encoded}`
}

function replaceHeaderUnsafeChars(value: string): string {
  let output = ''

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]!
    const next = value[index + 1]

    if (char === '\r' && next === '\n') {
      output += '_'
      index += 1
      continue
    }

    output += isHeaderUnsafeChar(char) ? '_' : char
  }

  return output
}

function isHeaderUnsafeChar(char: string): boolean {
  const code = char.charCodeAt(0)
  return code <= 31 || code === 127 || char === '"' || char === '\\' || char === ';'
}

function isAsciiFallbackSafeChar(char: string): boolean {
  const code = char.charCodeAt(0)
  if (code > 127) return false
  if (char === ' ') return true
  if (code >= 48 && code <= 57) return true
  if (code >= 65 && code <= 90) return true
  if (code >= 97 && code <= 122) return true
  return '!#$&+.^_`|~-'.includes(char)
}

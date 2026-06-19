/** 危险文件扩展名检查 */
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'com', 'msi', 'scr', 'pif',
  'vbs', 'vbe', 'js', 'jse', 'wsf', 'wsh', 'ps1', 'psm1', 'psd1',
  'jar', 'dmg', 'iso', 'app', 'deb', 'rpm',
  'sh', 'bash', 'zsh', 'csh', 'ksh', 'fish',
  'py', 'rb', 'pl', 'lua',
])

export function isDangerousFile(fileName: string): boolean {
  const segments = fileName.toLowerCase().split('.')
  // 检查所有扩展名段，防止双重扩展名绕过
  for (let i = 1; i < segments.length; i++) {
    if (DANGEROUS_EXTENSIONS.has(segments[i])) return true
  }
  return false
}

/** 检查字符串是否为有效的 http/https URL */
export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** 从 URL 提取域名 */
export function getDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

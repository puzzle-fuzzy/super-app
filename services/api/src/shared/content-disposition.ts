export function attachmentContentDisposition(fileName: string): string {
  const fallback = asciiFallbackFileName(fileName)
  const encoded = encodeURIComponent(fileName)
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`
}

function asciiFallbackFileName(fileName: string): string {
  const fallback = fileName
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/[;"\\\r\n]/g, '_')
    .trim()

  return fallback || 'download'
}

import sharp from 'sharp'
import { spawn } from 'node:child_process'

const THUMBNAIL_MAX_WIDTH = 400
const THUMBNAIL_QUALITY = 80

export interface MediaProbe {
  width?: number
  height?: number
  duration?: number
}

export interface ThumbnailResult {
  body: Buffer
  mimeType: string
}

/**
 * Extract dimensions/duration from a media buffer.
 *
 * Images are probed via sharp (no external process). Audio/video are probed via
 * the host's `ffprobe`. If ffprobe is unavailable or fails, the probe degrades
 * gracefully (returns `{}`) rather than failing the upload.
 */
export async function probeMedia(
  body: Buffer,
  mimeType: string,
  kind: 'image' | 'video' | 'audio' | 'subject' | 'text' | 'file' | 'style' | 'template'
): Promise<MediaProbe> {
  if (kind === 'image') {
    return probeImage(body)
  }
  if (kind === 'video' || kind === 'audio') {
    return probeWithFfprobe(body)
  }
  return {}
}

async function probeImage(body: Buffer): Promise<MediaProbe> {
  try {
    const metadata = await sharp(body).metadata()
    const probe: MediaProbe = {}
    if (metadata.width) probe.width = metadata.width
    if (metadata.height) probe.height = metadata.height
    return probe
  } catch {
    return {}
  }
}

async function probeWithFfprobe(body: Buffer): Promise<MediaProbe> {
  const json = await runFfprobe(body)
  if (!json?.streams?.length) {
    return {}
  }

  const probe: MediaProbe = {}
  // Prefer a video stream for dimensions, fall back to the first stream.
  const dimensionStream =
    json.streams.find((s) => s.width != null && s.height != null) ?? json.streams[0]
  if (dimensionStream?.width != null && dimensionStream?.height != null) {
    probe.width = dimensionStream.width
    probe.height = dimensionStream.height
  }
  const durationStream = json.streams.find((s) => s.duration != null)
  if (durationStream?.duration != null) {
    const duration = Number(durationStream.duration)
    if (!isNaN(duration)) {
      probe.duration = Math.round(duration)
    }
  }
  return probe
}

interface FfprobeStream {
  width?: number
  height?: number
  duration?: string
}

interface FfprobeOutput {
  streams?: FfprobeStream[]
}

async function runFfprobe(body: Buffer): Promise<FfprobeOutput | null> {
  return new Promise((resolve) => {
    const child = spawn('ffprobe', [
      '-v',
      'quiet',
      '-print_format',
      'json',
      '-show_streams',
      'pipe:0',
    ])

    let stdout = ''
    let errored = false

    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.on('error', () => {
      errored = true
    })
    child.on('close', () => {
      if (errored) {
        resolve(null)
        return
      }
      try {
        resolve(JSON.parse(stdout) as FfprobeOutput)
      } catch {
        resolve(null)
      }
    })

    child.stdin.on('error', () => {
      // EPIPE if ffprobe exits before reading; treat as no-probe.
      errored = true
    })
    child.stdin.end(body)
  })
}

/**
 * Generate a small JPEG thumbnail for an image or a poster frame for a video.
 * Returns null for kinds that have no visual thumbnail (audio/file/text/...).
 */
export async function generateThumbnail(
  body: Buffer,
  mimeType: string,
  kind: 'image' | 'video' | 'audio' | 'subject' | 'text' | 'file' | 'style' | 'template'
): Promise<ThumbnailResult | null> {
  if (kind === 'image') {
    return thumbnailImage(body)
  }
  if (kind === 'video') {
    return thumbnailVideo(body)
  }
  return null
}

async function thumbnailImage(body: Buffer): Promise<ThumbnailResult | null> {
  try {
    const out = await sharp(body)
      .resize({ width: THUMBNAIL_MAX_WIDTH, withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toBuffer()
    return { body: out, mimeType: 'image/jpeg' }
  } catch {
    return null
  }
}

async function thumbnailVideo(body: Buffer): Promise<ThumbnailResult | null> {
  // Extract a single frame at ~1s with ffmpeg, then resize via sharp.
  const frame = await extractVideoFrame(body)
  if (!frame) {
    return null
  }
  return thumbnailImage(frame)
}

function extractVideoFrame(body: Buffer): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', [
      '-v',
      'quiet',
      '-ss',
      '1',
      '-i',
      'pipe:0',
      '-frames:v',
      '1',
      '-f',
      'image2pipe',
      '-vcodec',
      'png',
      'pipe:1',
    ])

    const chunks: Buffer[] = []
    let errored = false

    child.stdout.on('data', (chunk) => {
      chunks.push(chunk as Buffer)
    })
    child.on('error', () => {
      errored = true
    })
    child.on('close', () => {
      if (errored || chunks.length === 0) {
        resolve(null)
        return
      }
      resolve(Buffer.concat(chunks))
    })

    child.stdin.on('error', () => {
      errored = true
    })
    child.stdin.end(body)
  })
}

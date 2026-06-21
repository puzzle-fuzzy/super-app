import { useEffect, useRef } from 'react'

interface RoseLoaderConfig {
  name: string
  tag: string
  rotate: boolean
  particleCount: number
  trailSpan: number
  durationMs: number
  rotationDurationMs: number
  pulseDurationMs: number
  strokeWidth: number
  roseA: number
  roseABoost: number
  roseBreathBase: number
  roseBreathBoost: number
  roseScale: number
  point(progress: number, detailScale: number, config: RoseLoaderConfig): { x: number; y: number }
  formula?: (config: RoseLoaderConfig) => string
}

const ROSE_CONFIG: RoseLoaderConfig = {
  name: 'Rose Three',
  tag: 'r = a cos(3θ)',
  rotate: true,
  particleCount: 76,
  trailSpan: 0.31,
  durationMs: 5300,
  rotationDurationMs: 28000,
  pulseDurationMs: 4400,
  strokeWidth: 4.6,
  roseA: 9.2,
  roseABoost: 0.6,
  roseBreathBase: 0.72,
  roseBreathBoost: 0.28,
  roseScale: 3.25,
  point(progress: number, detailScale: number, config: RoseLoaderConfig) {
    const t = progress * Math.PI * 2
    const a = config.roseA + detailScale * config.roseABoost
    const r =
      a * (config.roseBreathBase + detailScale * config.roseBreathBoost) * Math.cos(3 * t)
    return {
      x: 50 + Math.cos(t) * r * config.roseScale,
      y: 50 + Math.sin(t) * r * config.roseScale,
    }
  },
}

function normalizeProgress(progress: number) {
  return ((progress % 1) + 1) % 1
}

function getDetailScale(time: number, config: RoseLoaderConfig) {
  const pulseProgress = (time % config.pulseDurationMs) / config.pulseDurationMs
  const pulseAngle = pulseProgress * Math.PI * 2
  return 0.52 + ((Math.sin(pulseAngle + 0.55) + 1) / 2) * 0.48
}

function getRotation(time: number, config: RoseLoaderConfig) {
  if (!config.rotate) return 0
  return -((time % config.rotationDurationMs) / config.rotationDurationMs) * 360
}

function buildPath(detailScale: number, config: RoseLoaderConfig, steps = 480) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const point = config.point(index / steps, detailScale, config)
    return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
  }).join(' ')
}

function getParticle(
  index: number,
  progress: number,
  detailScale: number,
  config: RoseLoaderConfig
) {
  const tailOffset = index / (config.particleCount - 1)
  const point = config.point(
    normalizeProgress(progress - tailOffset * config.trailSpan),
    detailScale,
    config
  )
  const fade = Math.pow(1 - tailOffset, 0.56)
  return {
    x: point.x,
    y: point.y,
    radius: 0.9 + fade * 2.7,
    opacity: 0.04 + fade * 0.96,
  }
}

export function RoseLoader() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const SVG_NS = 'http://www.w3.org/2000/svg'

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 100 100')
    svg.setAttribute('fill', 'none')
    svg.setAttribute('aria-hidden', 'true')
    svg.style.width = '100%'
    svg.style.height = '100%'
    svg.style.overflow = 'visible'

    const group = document.createElementNS(SVG_NS, 'g')

    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('stroke', 'currentColor')
    path.setAttribute('stroke-linecap', 'round')
    path.setAttribute('stroke-linejoin', 'round')
    path.setAttribute('opacity', '0.12')
    path.setAttribute('stroke-width', String(ROSE_CONFIG.strokeWidth))
    group.appendChild(path)

    const particles = Array.from({ length: ROSE_CONFIG.particleCount }, () => {
      const circle = document.createElementNS(SVG_NS, 'circle')
      circle.setAttribute('fill', 'currentColor')
      group.appendChild(circle)
      return circle
    })

    svg.appendChild(group)
    container.appendChild(svg)

    let rafId: number
    const startedAt = performance.now()

    function render(now: number) {
      const time = now - startedAt
      const progress = (time % ROSE_CONFIG.durationMs) / ROSE_CONFIG.durationMs
      const detailScale = getDetailScale(time, ROSE_CONFIG)
      group.setAttribute(
        'transform',
        `rotate(${getRotation(time, ROSE_CONFIG)} 50 50)`
      )
      path.setAttribute('d', buildPath(detailScale, ROSE_CONFIG))
      particles.forEach((node, index) => {
        const particle = getParticle(index, progress, detailScale, ROSE_CONFIG)
        node.setAttribute('cx', particle.x.toFixed(2))
        node.setAttribute('cy', particle.y.toFixed(2))
        node.setAttribute('r', particle.radius.toFixed(2))
        node.setAttribute('opacity', particle.opacity.toFixed(3))
      })
      rafId = requestAnimationFrame(render)
    }

    rafId = requestAnimationFrame(render)

    return () => {
      cancelAnimationFrame(rafId)
      container.removeChild(svg)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="w-[min(14vmin,52px)] aspect-square text-[#999999]"
    />
  )
}

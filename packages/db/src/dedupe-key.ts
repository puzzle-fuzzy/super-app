/**
 * 去重工具 — 从 excuse 完整移植。
 *
 * - canonicalize: 递归排序对象 key、移除 undefined 值
 * - SHA-256: Web Crypto API（Bun 原生支持）
 * - createDedupeKey: `sha256:ownerId+model+params` 格式
 */

interface DedupeKeyInput {
  ownerId: string
  model: string
  parameters: unknown
  referenceFileIds?: readonly string[]
}

export interface GenerationRequestHashInput {
  model: string
  parameters: unknown
  referenceFileIds?: readonly string[]
}

const IDEMPOTENCY_KEY_MAX_LENGTH = 128
const IDEMPOTENCY_KEY_PATTERN = /^[\w.~:-]+$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : canonicalize(item)))
  }

  if (!isPlainObject(value)) {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalize(item)])
  )
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value))
}

async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

// --- 公共函数 ---

export function normalizeIdempotencyKey(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  return normalized || null
}

export function isValidIdempotencyKey(value: string): boolean {
  return value.length <= IDEMPOTENCY_KEY_MAX_LENGTH && IDEMPOTENCY_KEY_PATTERN.test(value)
}

export async function createIdempotencyKeyHash(value: string): Promise<string> {
  return sha256Hex(value)
}

export async function createGenerationRequestHash(input: GenerationRequestHashInput): Promise<string> {
  const canonicalPayload = canonicalStringify({
    model: input.model,
    parameters: input.parameters,
    referenceFileIds: input.referenceFileIds,
  })
  return sha256Hex(canonicalPayload)
}

export async function createGenericRequestHash(payload: unknown): Promise<string> {
  return sha256Hex(canonicalStringify(payload))
}

/**
 * 生成稳定去重键。
 * 格式: `sha256:<hex>`
 * ownerId + model + canonicalized parameters → 相同语义请求产生相同键
 */
export async function createDedupeKey(input: DedupeKeyInput): Promise<string> {
  const canonicalPayload = canonicalStringify({
    ownerId: input.ownerId,
    model: input.model,
    parameters: input.parameters,
    referenceFileIds: input.referenceFileIds,
  })
  return `sha256:${await sha256Hex(canonicalPayload)}`
}

export const __test = { canonicalStringify }

import { useEffect, useState } from 'react'
import { ImageIcon, RotateCcw, SlidersHorizontal } from 'lucide-react'

import {
  DEFAULT_GENERATION_MODEL_ID,
  GENERATION_MODELS,
  getGenerationModel,
  imageSizeToAspectRatio,
  isImageGenerationModel,
  isVideoGenerationModel,
  videoRatioToAspectRatio,
  type GenerationModelId,
  type ImageSize,
  type VideoRatio,
  type VideoResolution,
} from '@super-app/ai-models'
import type { CanvasGenerateImageRequest } from '@super-app/contracts/canvas'
import { Select } from '@super-app/ui-react'

import { useUIStore } from '../../stores/uiStore'

/* ---- Pure helpers ---- */

export function buildGenerationInput(input: {
  prompt: string
  model: GenerationModelId
  size: ImageSize
  ratio: VideoRatio
  resolution: VideoResolution
  duration: number
  negativePrompt: string
  promptExtend: boolean
  watermark: boolean
  seed: string
}): CanvasGenerateImageRequest {
  const model = getGenerationModel(input.model) ?? GENERATION_MODELS[0]
  const seed = input.seed ? Number(input.seed) : undefined
  const common = {
    prompt: input.prompt,
    model: input.model,
    negativePrompt: input.negativePrompt.trim() || undefined,
    promptExtend: model.supportsPromptExtend ? input.promptExtend : undefined,
    watermark: input.watermark,
    seed,
  }

  if (isVideoGenerationModel(model)) {
    return {
      ...common,
      kind: 'video',
      ratio: input.ratio,
      resolution: input.resolution,
      duration: Math.min(Math.max(input.duration, model.minDuration), model.maxDuration),
    }
  }

  return {
    ...common,
    kind: 'image',
    size: input.size,
  }
}

export function generationNodeDimensions(
  input: CanvasGenerateImageRequest
): {
  width: number
  height: number
} {
  const width = 320
  const ratio =
    input.kind === 'video'
      ? videoRatioToAspectRatio(input.ratio ?? '16:9')
      : imageSizeToAspectRatio((input.size ?? '2048*2048') as ImageSize)
  return {
    width,
    height: Math.round(width * ratio),
  }
}

export function imageSizeLabel(size: ImageSize): string {
  const [w, h] = size.split('*').map(Number)
  const width = w!
  const height = h!
  const ratio = width === height ? '1:1' : width > height ? '横图' : '竖图'
  return `${ratio} ${size}`
}

/* ---- Component ---- */

export function ImageGenerationPromptBar({
  onGenerate,
}: {
  onGenerate: (
    input: CanvasGenerateImageRequest
  ) => Promise<{
    prompt: string
    url?: string
    imageUrl?: string
    videoUrl?: string
  }>
}) {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<GenerationModelId>(DEFAULT_GENERATION_MODEL_ID)
  const modelConfig = getGenerationModel(model) ?? GENERATION_MODELS[0]
  const [size, setSize] = useState<ImageSize>(
    isImageGenerationModel(modelConfig) ? modelConfig.defaultSize : '2048*2048'
  )
  const [ratio, setRatio] = useState<VideoRatio>('16:9')
  const [resolution, setResolution] = useState<VideoResolution>('720P')
  const [duration, setDuration] = useState(5)
  const [negativePrompt, setNegativePrompt] = useState('')
  const [promptExtend, setPromptExtend] = useState(true)
  const [watermark, setWatermark] = useState(false)
  const [seed, setSeed] = useState('')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [lastInput, setLastInput] = useState<CanvasGenerateImageRequest | null>(null)

  useEffect(() => {
    if (isImageGenerationModel(modelConfig)) {
      setSize(modelConfig.defaultSize)
      return
    }
    setRatio(modelConfig.defaultRatio)
    setResolution(modelConfig.defaultResolution)
    setDuration(modelConfig.defaultDuration)
    setPromptExtend(modelConfig.supportsPromptExtend)
    setWatermark(false)
  }, [modelConfig])

  // 监听 generationPrefill，从资产详情视图回填生成参数
  const generationPrefill = useUIStore((s) => s.generationPrefill)
  const setGenerationPrefill = useUIStore((s) => s.setGenerationPrefill)
  useEffect(() => {
    if (!generationPrefill) return
    if (generationPrefill.prompt) setPrompt(generationPrefill.prompt)
    if (generationPrefill.negativePrompt) setNegativePrompt(generationPrefill.negativePrompt)
    if (generationPrefill.model) {
      const modelId = generationPrefill.model as GenerationModelId
      if (getGenerationModel(modelId)) setModel(modelId)
    }
    if (generationPrefill.size) setSize(generationPrefill.size as ImageSize)
    if (generationPrefill.ratio) setRatio(generationPrefill.ratio as VideoRatio)
    if (generationPrefill.resolution) setResolution(generationPrefill.resolution as VideoResolution)
    if (generationPrefill.duration != null) setDuration(generationPrefill.duration)
    if (generationPrefill.seed != null) setSeed(String(generationPrefill.seed))
    if (generationPrefill.promptExtend != null) setPromptExtend(generationPrefill.promptExtend)
    if (generationPrefill.watermark != null) setWatermark(generationPrefill.watermark)
    // 消费后清除，避免重复触发
    setGenerationPrefill(null)
  }, [generationPrefill, setGenerationPrefill])

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = prompt.trim()
    if (!trimmed || generating) return

    const input = buildGenerationInput({
      prompt: trimmed,
      model,
      size,
      ratio,
      resolution,
      duration,
      negativePrompt,
      promptExtend,
      watermark,
      seed,
    })
    setLastInput(input)
    setStatus(null)
    await runGeneration(input)
  }

  async function retryLast() {
    if (!lastInput || generating) return
    setStatus(null)
    await runGeneration(lastInput)
  }

  async function runGeneration(input: CanvasGenerateImageRequest) {
    setGenerating(true)
    try {
      await onGenerate(input)
      setPrompt('')
      setStatus({
        type: 'success',
        text:
          input.kind === 'video' ? '视频已生成，并添加到画布。' : '图片已生成，并添加到画布。',
      })
    } catch (err) {
      setStatus({
        type: 'error',
        text: err instanceof Error ? err.message : '生成失败',
      })
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="pointer-events-none fixed right-6 bottom-6 left-6 z-40 flex justify-center">
      <form
        onSubmit={submit}
        className="pointer-events-auto w-full max-w-[860px] overflow-hidden rounded-4xl border border-[#343434] bg-[#191919] shadow-[0_14px_42px_rgba(0,0,0,0.36)]"
      >
        <div className="grid gap-3 p-3">
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="描述你想生成的图片或视频..."
            rows={5}
            className="min-h-24 resize-none rounded-xl border border-[#303030] bg-[#101010] px-4 py-3 text-[14px] leading-relaxed text-[#eeeeee] outline-none transition-colors placeholder:text-[#8a8a8a] focus:border-[#686868]"
          />

          {advancedOpen ? (
            <div className="grid gap-3 rounded-xl border border-[#2a2a2a] bg-[#141414] p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-[#a3a3a3]">模型</span>
                  <Select
                    value={model}
                    onChange={setModel}
                    options={GENERATION_MODELS.map((item) => ({
                      value: item.id,
                      label: item.label,
                    }))}
                  />
                  <span className="text-xs text-[#777777]">{modelConfig.description}</span>
                </label>

                {isImageGenerationModel(modelConfig) ? (
                  <label className="grid gap-1.5">
                    <span className="text-xs font-medium text-[#a3a3a3]">图片尺寸</span>
                    <Select
                      value={size}
                      onChange={setSize}
                      options={modelConfig.sizes.map((item) => ({
                        value: item,
                        label: imageSizeLabel(item),
                      }))}
                    />
                  </label>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-[#a3a3a3]">视频比例</span>
                      <Select
                        value={ratio}
                        onChange={setRatio}
                        options={modelConfig.ratios.map((item) => ({
                          value: item,
                          label: item,
                        }))}
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-xs font-medium text-[#a3a3a3]">清晰度</span>
                      <Select
                        value={resolution}
                        onChange={setResolution}
                        options={modelConfig.resolutions.map((item) => ({
                          value: item,
                          label: item,
                        }))}
                      />
                    </label>
                  </div>
                )}
              </div>

              {isVideoGenerationModel(modelConfig) ? (
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-[#a3a3a3]">
                    时长：{duration} 秒
                  </span>
                  <input
                    type="range"
                    min={modelConfig.minDuration}
                    max={modelConfig.maxDuration}
                    value={duration}
                    onChange={(event) => setDuration(Number(event.target.value))}
                    className="accent-[#e5e5e5]"
                  />
                </label>
              ) : null}

              {modelConfig.supportsNegativePrompt ? (
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-[#a3a3a3]">反向提示词</span>
                  <input
                    value={negativePrompt}
                    onChange={(event) => setNegativePrompt(event.target.value)}
                    placeholder="不希望出现的内容..."
                    className="h-9 rounded-lg border border-[#303030] bg-[#101010] px-3 text-[13px] text-[#eeeeee] outline-none placeholder:text-[#777777] focus:border-[#686868]"
                  />
                </label>
              ) : null}

              <div className="flex flex-wrap gap-3 text-[13px] text-[#d4d4d4]">
                {modelConfig.supportsPromptExtend ? (
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={promptExtend}
                      onChange={(event) => setPromptExtend(event.target.checked)}
                    />
                    智能扩写
                  </label>
                ) : null}
                {'supportsWatermark' in modelConfig || isImageGenerationModel(modelConfig) ? (
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={watermark}
                      onChange={(event) => setWatermark(event.target.checked)}
                    />
                    添加水印
                  </label>
                ) : null}
                {modelConfig.supportsSeed ? (
                  <label className="inline-flex items-center gap-2">
                    <span className="text-[#a3a3a3]">Seed</span>
                    <input
                      value={seed}
                      onChange={(event) =>
                        setSeed(event.target.value.replace(/\D/g, '').slice(0, 10))
                      }
                      placeholder="随机"
                      className="h-8 w-28 rounded-lg border border-[#303030] bg-[#101010] px-2 text-[13px] text-[#eeeeee] outline-none placeholder:text-[#777777] focus:border-[#686868]"
                    />
                  </label>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-h-9 items-center gap-2">
              <button
                type="button"
                onClick={() => setAdvancedOpen((open) => !open)}
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-[#303030] bg-[#202020] px-3 text-[13px] font-medium text-[#d4d4d4] transition-colors hover:border-[#4a4a4a] hover:bg-[#282828]"
              >
                <SlidersHorizontal size={14} aria-hidden="true" />
                高级参数
              </button>
              {status ? (
                <p
                  className={`m-0 text-[13px] ${
                    status.type === 'error' ? 'text-[#ffaaa3]' : 'text-[#b8e6c2]'
                  }`}
                >
                  {status.text}
                </p>
              ) : (
                <p className="m-0 hidden text-[13px] text-[#777777] sm:block">
                  输入提示词后生成，结果会自动落在画布中心。
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              {status?.type === 'error' && lastInput ? (
                <button
                  type="button"
                  disabled={generating}
                  onClick={retryLast}
                  className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-[#7a3831] bg-[#3a2420] px-4 text-[13px] font-semibold text-[#ffd4cf] transition-colors hover:border-[#b9564b] hover:bg-[#4a2b25] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  重试
                </button>
              ) : null}
              <button
                type="submit"
                disabled={!prompt.trim() || generating}
                className="inline-flex h-10 min-w-28 cursor-pointer items-center justify-center gap-2 rounded-xl border-0 bg-[#e5e5e5] px-5 text-[13px] font-semibold text-[#141414] transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ImageIcon size={15} aria-hidden="true" />
                {generating
                  ? '生成中...'
                  : isVideoGenerationModel(modelConfig)
                    ? '生成视频'
                    : '生成图片'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </section>
  )
}

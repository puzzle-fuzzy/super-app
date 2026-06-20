import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))
const authUrl = 'http://localhost:5100/auth/'
const canvasUrl = 'http://localhost:5104/canvas/'
const samplePng = path.resolve(here, 'fixtures/sample.png')

test('generates an image node from the canvas bottom prompt bar', async ({ page }) => {
  const email = `e2e-canvas-generate-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const prompt = '赛博城市夜景，霓虹灯，电影感'
  const generatedUrl = 'https://fake-provider.local/generated.png'
  const requests: unknown[] = []
  let releaseGeneration!: () => void
  const generationReady = new Promise<void>((resolve) => {
    releaseGeneration = resolve
  })

  await page.route('**/api/canvas/generate-image', async (route) => {
    requests.push(route.request().postDataJSON())
    await generationReady
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          prompt,
          model: 'qwen-image-2.0-pro',
          imageUrl: generatedUrl,
          requestId: 'fake-request-id',
        },
      }),
    })
  })
  await page.route(generatedUrl, async (route) => {
    await route.fulfill({ path: samplePng, contentType: 'image/png' })
  })

  await page.goto(canvasUrl)
  await expect(page).toHaveURL(new RegExp(`^${authUrl}login\\?return_to=`))

  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill('Canvas Generate User')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(canvasUrl)
  await page.getByRole('button', { name: '新建画布' }).first().click()
  await page.getByPlaceholder('输入项目名称').fill('生成测试画布')
  await page.getByRole('button', { name: '创建' }).click()
  await page.getByText('生成测试画布').click()

  await page.getByPlaceholder('描述你想生成的图片或视频...').fill(prompt)
  await expect(page.getByRole('button', { name: '高级参数' })).toBeVisible()
  await page.getByRole('button', { name: '生成图片' }).click()

  await expect(page.getByText('正在生成图片...')).toBeVisible()
  releaseGeneration()
  await expect(page.getByAltText(prompt)).toBeVisible()
  expect(requests).toEqual([
    {
      kind: 'image',
      prompt,
      model: 'qwen-image-2.0-pro',
      size: '2048*2048',
      promptExtend: true,
      watermark: false,
    },
  ])
})

test('generates a video node from a video model', async ({ page }) => {
  const email = `e2e-canvas-generate-video-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const prompt = '一段雨夜城市延时摄影'
  const generatedUrl = 'https://fake-provider.local/generated.mp4'
  const requests: unknown[] = []
  let releaseGeneration!: () => void
  const generationReady = new Promise<void>((resolve) => {
    releaseGeneration = resolve
  })

  await page.route('**/api/canvas/generate-image', async (route) => {
    requests.push(route.request().postDataJSON())
    await generationReady
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          kind: 'video',
          prompt,
          model: 'happyhorse-1.0-t2v',
          url: generatedUrl,
          videoUrl: generatedUrl,
          requestId: 'fake-video-request-id',
        },
      }),
    })
  })

  await page.goto(canvasUrl)
  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill('Canvas Video User')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(canvasUrl)
  await page.getByRole('button', { name: '新建画布' }).first().click()
  await page.getByPlaceholder('输入项目名称').fill('生成视频测试画布')
  await page.getByRole('button', { name: '创建' }).click()
  await page.getByText('生成视频测试画布').click()

  await page.getByRole('button', { name: '高级参数' }).click()
  await page.locator('label').filter({ hasText: '模型' }).getByRole('button').click()
  await page.getByRole('option', { name: 'HappyHorse 文生视频' }).click()
  await expect(page.getByRole('button', { name: '生成视频' })).toBeVisible()

  await page.getByPlaceholder('描述你想生成的图片或视频...').fill(prompt)
  await page.getByRole('button', { name: '生成视频' }).click()

  await expect(page.getByText('正在生成视频...')).toBeVisible()
  releaseGeneration()
  await expect(page.locator('video[src="https://fake-provider.local/generated.mp4"]')).toBeVisible()
  expect(requests).toEqual([
    {
      kind: 'video',
      prompt,
      model: 'happyhorse-1.0-t2v',
      ratio: '16:9',
      resolution: '720P',
      duration: 5,
      watermark: false,
    },
  ])
})

test('retries a failed canvas image generation request', async ({ page }) => {
  const email = `e2e-canvas-generate-retry-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const prompt = '一次失败后重试的海报'
  const generatedUrl = 'https://fake-provider.local/retry-generated.png'
  let attempts = 0

  await page.route('**/api/canvas/generate-image', async (route) => {
    attempts += 1
    if (attempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'INTERNAL_ERROR', message: '生成服务暂时不可用' },
        }),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          prompt,
          model: 'qwen-image-2.0-pro',
          imageUrl: generatedUrl,
          requestId: 'fake-retry-request-id',
        },
      }),
    })
  })
  await page.route(generatedUrl, async (route) => {
    await route.fulfill({ path: samplePng, contentType: 'image/png' })
  })

  await page.goto(canvasUrl)
  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill('Canvas Retry User')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(canvasUrl)
  await page.getByRole('button', { name: '新建画布' }).first().click()
  await page.getByPlaceholder('输入项目名称').fill('生成重试测试画布')
  await page.getByRole('button', { name: '创建' }).click()
  await page.getByText('生成重试测试画布').click()

  await page.getByPlaceholder('描述你想生成的图片或视频...').fill(prompt)
  await page.getByRole('button', { name: '生成图片' }).click()

  await expect(page.getByText('生成服务暂时不可用')).toBeVisible()
  await page.getByRole('button', { name: '重试' }).click()

  await expect(page.getByAltText(prompt)).toBeVisible()
  expect(attempts).toBe(2)
})

test('adds a generated image from persisted history', async ({ page }) => {
  const email = `e2e-canvas-generate-history-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const prompt = '历史里的稳定生成图'
  const historyUrl = 'https://fake-provider.local/history-generated.png'

  await page.route('**/api/assets/?limit=20', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          items: [
            {
              id: 'asset-history-1',
              kind: 'image',
              title: `AI 生成图 - ${prompt}`,
              tags: [],
              status: 'active',
              visibility: 'private',
              source: 'ai_generation',
              metadata: {
                prompt,
                provider: 'dashscope',
                model: 'qwen-image-2.0-pro',
              },
              files: [
                {
                  id: 'file-history-1',
                  role: 'original',
                  storageBucket: 'local',
                  storageKey: 'history/generated.png',
                  url: historyUrl,
                  mimeType: 'image/png',
                  size: 128,
                  createdAt: new Date().toISOString(),
                },
              ],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
          nextCursor: null,
        },
      }),
    })
  })
  await page.route(historyUrl, async (route) => {
    await route.fulfill({ path: samplePng, contentType: 'image/png' })
  })

  await page.goto(canvasUrl)
  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill('Canvas History User')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(canvasUrl)
  await page.getByRole('button', { name: '新建画布' }).first().click()
  await page.getByPlaceholder('输入项目名称').fill('生成历史测试画布')
  await page.getByRole('button', { name: '创建' }).click()
  await page.getByText('生成历史测试画布').click()

  await page.getByRole('button', { name: '生成历史' }).click()
  await expect(page.getByText(prompt)).toBeVisible()
  await page.getByRole('button', { name: `添加 ${prompt}` }).click()

  await expect(page.getByAltText(prompt)).toBeVisible()
})

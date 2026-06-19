import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))
const authUrl = 'http://localhost:5100/auth/'
const canvasUrl = 'http://localhost:5104/canvas/'
const samplePng = path.resolve(here, 'fixtures/sample.png')

test('generates an image node from the canvas chat panel', async ({ page }) => {
  const email = `e2e-canvas-generate-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const prompt = '赛博城市夜景，霓虹灯，电影感'
  const generatedUrl = 'https://fake-provider.local/generated.png'
  const requests: unknown[] = []

  await page.route('**/api/canvas/generate-image', async (route) => {
    requests.push(route.request().postDataJSON())
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

  await page.getByPlaceholder('描述你想生成的图片...').fill(prompt)
  await page.getByRole('button', { name: '生成图片' }).click()

  await expect(page.getByAltText(prompt)).toBeVisible()
  expect(requests).toEqual([{ prompt, model: 'qwen-image-2.0-pro', size: '2048*2048' }])
})

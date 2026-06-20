import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

import { expect, test } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))
const authUrl = 'http://localhost:5100/auth/'
const assetsUrl = 'http://localhost:5105/assets/'
const samplePng = path.resolve(here, 'fixtures/sample.png')
const samplePngBuffer = readFileSync(samplePng)

test('uploads an asset from the assets app after registering', async ({ context, page }) => {
  const email = `e2e-assets-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const name = 'E2E Assets User'

  await page.goto(assetsUrl)
  await expect(page).toHaveURL(new RegExp(`^${authUrl}login\\?return_to=`))

  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill(name)
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(assetsUrl)
  await expect(page.getByRole('heading', { name: '素材库' })).toBeVisible()
  await expect(page.getByRole('button', { name: '退出登录' })).toHaveCount(0)
  await page.getByRole('button', { name: '打开用户菜单' }).click()
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()
  await page.getByRole('heading', { name: '素材库' }).click()
  await expect(page.getByRole('button', { name: '退出登录' })).toHaveCount(0)

  // Empty state before any upload.
  await expect(page.getByRole('heading', { name: '还没有资产' })).toBeVisible()

  // Upload the sample PNG.
  await page.setInputFiles('input[type=file]', samplePng)

  // The asset card appears under 全部.
  await expect(page.getByText('sample.png').first()).toBeVisible()

  // The card also appears under the 图片 filter.
  await page.getByRole('tab', { name: '图片', exact: true }).click()
  await expect(page.getByText('sample.png').first()).toBeVisible()

  // The asset can be shared over a short-lived LAN transfer room.
  await page.getByRole('button', { name: '更多操作' }).first().click()
  await page.getByRole('button', { name: '传输' }).first().click()
  const transferDialog = page.getByRole('dialog', { name: '传输分享' })
  await expect(transferDialog).toBeVisible()
  const transferUrl = (await transferDialog.locator('code').textContent())!
  const receiver = await context.newPage()
  await receiver.goto(transferUrl)
  await expect(receiver.getByRole('heading', { name: '局域网文件接收' })).toBeVisible()
  await expect(receiver.getByText('sample.png')).toBeVisible()
  await receiver.getByRole('button', { name: '接收文件' }).click()
  await expect(receiver.getByRole('link', { name: /下载 sample\.png/ })).toBeVisible()
  await receiver.close()
  await transferDialog.getByRole('button', { name: '关闭' }).click()

  // Delete the asset.
  await page.getByRole('button', { name: '更多操作' }).first().click()
  await page.getByRole('button', { name: '删除' }).first().click()
  await page.getByRole('button', { name: '确认删除' }).click()
  await expect(page.getByText('sample.png')).toHaveCount(0)

  // The deletion persists after a reload (soft-deleted, excluded from list).
  await page.reload()
  await expect(page.getByText('sample.png')).toHaveCount(0)
})

test('uploads multiple selected assets from the assets app', async ({ page }) => {
  const email = `e2e-assets-multi-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'

  await page.goto(assetsUrl)
  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill('E2E Multi Assets User')
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(assetsUrl)
  await page.setInputFiles('input[type=file]', [
    {
      name: 'multi-one.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    },
    {
      name: 'multi-two.png',
      mimeType: 'image/png',
      buffer: samplePngBuffer,
    },
  ])

  await expect(page.getByText('multi-one.png').first()).toBeVisible()
  await expect(page.getByText('multi-two.png').first()).toBeVisible()
  await expect(page.getByText('正在浏览').locator('..')).toContainText('2 个素材')
})

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { expect, test } from '@playwright/test'

const here = path.dirname(fileURLToPath(import.meta.url))
const authUrl = 'http://localhost:5100/auth/'
const assetsUrl = 'http://localhost:5105/assets/'
const samplePng = path.resolve(here, 'fixtures/sample.png')

test('uploads an asset from the assets app after registering', async ({ page }) => {
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
  await expect(page.getByRole('heading', { name: '资产中心' })).toBeVisible()

  // Empty state before any upload.
  await expect(page.getByRole('heading', { name: '还没有资产' })).toBeVisible()

  // Upload the sample PNG.
  await page.setInputFiles('input[type=file]', samplePng)

  // The asset card appears under 全部.
  await expect(page.getByText('sample.png').first()).toBeVisible()

  // The card also appears under the 图片 filter.
  await page.getByRole('tab', { name: '图片', exact: true }).click()
  await expect(page.getByText('sample.png').first()).toBeVisible()

  // Delete the asset.
  await page.getByRole('button', { name: '删除' }).first().click()
  await page.getByRole('button', { name: '确认删除' }).click()
  await expect(page.getByText('sample.png')).toHaveCount(0)

  // The deletion persists after a reload (soft-deleted, excluded from list).
  await page.reload()
  await expect(page.getByText('sample.png')).toHaveCount(0)
})

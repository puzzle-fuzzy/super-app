import { expect, test } from '@playwright/test'

const authUrl = 'http://localhost:5100/auth/'
const assetsUrl = 'http://localhost:5105/assets/'

test('creates, edits, and deletes a style asset in the assets app', async ({ page }) => {
  const email = `e2e-styles-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const name = 'E2E Styles User'

  await page.goto(assetsUrl)
  await expect(page).toHaveURL(new RegExp(`^${authUrl}login\\?return_to=`))

  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill(name)
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(assetsUrl)
  await expect(page.getByRole('heading', { name: '素材库' })).toBeVisible()

  // Create a style via the 新建风格 button.
  await page.getByRole('button', { name: '新建风格' }).click()

  await page.getByLabel('标题').fill('胶片街拍')
  await page.getByLabel('正向提示词').fill('35mm film grain, street photography')
  await page.getByRole('button', { name: '保存' }).click()

  // The card appears.
  await expect(page.getByText('胶片街拍').first()).toBeVisible()

  // Edit via the 更多操作 (more actions) menu → 重命名 (rename/edit).
  await page.getByRole('button', { name: '更多操作' }).first().click()
  await page.getByRole('button', { name: '重命名' }).first().click()
  await page.getByLabel('负面提示词').fill('blurry, low quality')
  await page.getByRole('button', { name: '保存' }).click()

  // Delete via the 更多操作 menu → 删除.
  await page.getByRole('button', { name: '更多操作' }).first().click()
  await page.getByRole('button', { name: '删除' }).first().click()
  // Confirm delete if a confirm dialog appears.
  const confirmButton = page.getByRole('button', { name: '确认删除' })
  if (await confirmButton.isVisible().catch(() => false)) {
    await confirmButton.click()
  }
  await expect(page.getByText('胶片街拍')).toHaveCount(0)
})

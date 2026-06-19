import { expect, test } from '@playwright/test'

const authUrl = 'http://localhost:5100/auth/'
const assetsUrl = 'http://localhost:5105/assets/'

test('creates, edits, and deletes a text asset in the assets app', async ({ page }) => {
  const email = `e2e-texts-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const name = 'E2E Texts User'

  await page.goto(assetsUrl)
  await expect(page).toHaveURL(new RegExp(`^${authUrl}login\\?return_to=`))

  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill(name)
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(assetsUrl)
  await expect(page.getByRole('heading', { name: '资产中心' })).toBeVisible()

  // Switch to the text filter and create a text asset.
  await page.getByRole('tab', { name: '文本' }).click()
  await page.getByRole('button', { name: '新建文本' }).click()

  await page.getByLabel('标题').fill('测试提示词')
  await page.getByLabel('正文').fill('这是第一版正文内容')
  await page.getByRole('button', { name: '保存' }).click()

  // The card appears.
  await expect(page.getByText('测试提示词').first()).toBeVisible()

  // Edit the content.
  await page.getByRole('button', { name: '编辑' }).first().click()
  await page.getByLabel('正文').fill('这是修改后的正文')
  await page.getByRole('button', { name: '保存' }).click()

  // Delete.
  await page.getByRole('button', { name: '删除' }).first().click()
  await expect(page.getByText('测试提示词')).toHaveCount(0)
})

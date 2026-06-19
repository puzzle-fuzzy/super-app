import { expect, test } from '@playwright/test'

const authUrl = 'http://localhost:5100/auth/'
const assetsUrl = 'http://localhost:5105/assets/'

test('creates, edits, and deletes a subject asset in the assets app', async ({ page }) => {
  const email = `e2e-subjects-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const name = 'E2E Subjects User'

  await page.goto(assetsUrl)
  await expect(page).toHaveURL(new RegExp(`^${authUrl}login\\?return_to=`))

  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill(name)
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(assetsUrl)
  await expect(page.getByRole('heading', { name: '资产中心' })).toBeVisible()

  // Switch to the subject filter and create a subject asset.
  await page.getByRole('tab', { name: '主体' }).click()
  await page.getByRole('button', { name: '新建主体' }).click()

  await page.getByLabel('标题').fill('我的主角')
  await page.getByLabel('身份提示词').fill('一位短发年轻女性')
  await page.getByRole('button', { name: '保存' }).click()

  // The card appears.
  await expect(page.getByText('我的主角').first()).toBeVisible()

  // Edit the appearance prompt.
  await page.getByRole('button', { name: '编辑' }).first().click()
  await page.getByLabel('外观提示词').fill('穿着红色外套')
  await page.getByRole('button', { name: '保存' }).click()

  // Delete.
  await page.getByRole('button', { name: '删除' }).first().click()
  await expect(page.getByText('我的主角')).toHaveCount(0)
})

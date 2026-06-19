import { expect, test } from '@playwright/test'

const authUrl = 'http://localhost:5100/auth/'
const workspaceUrl = 'http://localhost:5103/workspace/'

test('registers from the login center and returns to workspace', async ({ page }) => {
  const email = `e2e-${Date.now()}-${test.info().parallelIndex}@super.test`
  const password = 'super-e2e-password'
  const name = 'E2E User'

  await page.goto(workspaceUrl)

  await expect(page).toHaveURL(new RegExp(`^${authUrl}login\\?return_to=`))
  await expect(
    page.getByRole('heading', { name: '一次登录，进入你的统一创作工作区。' })
  ).toBeVisible()

  await page.getByRole('tab', { name: '注册' }).click()
  await page.getByLabel('名称').fill(name)
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel('密码').fill(password)
  await page.getByRole('button', { name: '创建并进入' }).click()

  await expect(page).toHaveURL(workspaceUrl)
  await expect(page.getByRole('heading', { name: `欢迎回来，${name}` })).toBeVisible()
  await expect(page.getByRole('link', { name: '资产库' }).first()).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: `欢迎回来，${name}` })).toBeVisible()

  await page.getByRole('button', { name: '退出登录' }).click()
  await expect(page).toHaveURL(authUrl)
  await expect(page.getByRole('button', { name: '登录 Super' })).toBeVisible()

  await page.goto(workspaceUrl)
  await expect(page).toHaveURL(new RegExp(`^${authUrl}login\\?return_to=`))
})

import { createSuperViteAppConfig } from '@super-app/vite-config'

export default createSuperViteAppConfig({
  appUrl: import.meta.url,
  base: '/transfer/',
  port: 5106,
})

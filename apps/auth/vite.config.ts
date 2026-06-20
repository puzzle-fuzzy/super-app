import { createSuperViteAppConfig } from '@super-app/vite-config'

export default createSuperViteAppConfig({
  appUrl: import.meta.url,
  base: '/auth/',
  port: 5100,
})

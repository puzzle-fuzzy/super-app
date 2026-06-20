import { createSuperViteAppConfig } from '@super-app/vite-config'

export default createSuperViteAppConfig({
  appUrl: import.meta.url,
  base: '/',
  port: 5101,
})

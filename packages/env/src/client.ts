import { parsePublicEnv } from './public'

type ImportMetaWithEnv = ImportMeta & {
  env?: Record<string, string | undefined>
}

const envSource = (import.meta as ImportMetaWithEnv).env ?? {}

export const clientEnv = parsePublicEnv(envSource)

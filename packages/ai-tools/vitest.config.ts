import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  test: {
    alias: {
      'v0-sdk': path.resolve(dirname, 'tests/__mocks__/v0-sdk.ts'),
    },
  },
})

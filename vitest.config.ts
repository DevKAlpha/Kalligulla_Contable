import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'domain', root: './packages/domain', environment: 'node' } },
      { test: { name: 'api', root: './packages/api', environment: 'node' } },
      {
        resolve: { alias: { '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)) } },
        test: { name: 'web', root: './apps/web', environment: 'happy-dom' },
      },
    ],
  },
})

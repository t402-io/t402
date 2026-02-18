import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    pool: 'forks',
    alias: {
      'react-native': new URL('./test/__mocks__/react-native.ts', import.meta.url).pathname,
    },
  },
})

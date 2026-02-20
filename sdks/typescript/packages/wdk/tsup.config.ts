import { defineConfig } from 'tsup'

const sharedEntry = [
  'src/index.ts',
  'src/adapters/index.ts',
  'src/adapters/ton-adapter.ts',
  'src/adapters/svm-adapter.ts',
  'src/adapters/tron-adapter.ts',
  'src/integrations/index.ts',
  'src/testing/index.ts',
]

export default defineConfig([
  {
    entry: sharedEntry,
    outDir: 'dist/esm',
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: sharedEntry,
    outDir: 'dist/cjs',
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
])

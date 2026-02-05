import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: [
      'src/index.ts',
      'src/adapters/index.ts',
      'src/adapters/ton-adapter.ts',
      'src/adapters/svm-adapter.ts',
      'src/adapters/tron-adapter.ts',
    ],
    outDir: 'dist/esm',
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
  {
    entry: [
      'src/index.ts',
      'src/adapters/index.ts',
      'src/adapters/ton-adapter.ts',
      'src/adapters/svm-adapter.ts',
      'src/adapters/tron-adapter.ts',
    ],
    outDir: 'dist/cjs',
    format: ['cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
  },
])

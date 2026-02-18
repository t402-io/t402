import { defineConfig } from 'tsup'

const baseConfig = {
  entry: {
    index: 'src/index.ts',
    'exact/client/index': 'src/exact/client/index.ts',
    'exact/server/index': 'src/exact/server/index.ts',
    'exact/facilitator/index': 'src/exact/facilitator/index.ts',
    'lightning/client/index': 'src/lightning/client/index.ts',
    'lightning/server/index': 'src/lightning/server/index.ts',
    'lightning/facilitator/index': 'src/lightning/facilitator/index.ts',
  },
  dts: {
    resolve: true,
  },
  sourcemap: true,
  target: 'es2020',
}

export default defineConfig([
  {
    ...baseConfig,
    format: 'esm',
    outDir: 'dist/esm',
    clean: true,
  },
  {
    ...baseConfig,
    format: 'cjs',
    outDir: 'dist/cjs',
    clean: false,
  },
])

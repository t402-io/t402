import { defineConfig } from 'tsup'

const baseConfig = {
  entry: {
    index: 'src/index.ts',
    'server/index': 'src/server/index.ts',
    'tools/index': 'src/tools/index.ts',
  },
  external: ['@t402/wdk', '@t402/wdk-protocol'],
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

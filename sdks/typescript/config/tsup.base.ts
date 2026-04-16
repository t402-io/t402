import { defineConfig, type Options } from "tsup";

interface TsupConfigOptions {
  /** Entry points — object map or string array */
  entry: Record<string, string> | string[];
  /** Build target (default: "es2020") */
  target?: string;
  /** Packages to exclude from bundle */
  external?: string[];
  /** JS banner per format (e.g. shebang for CLI) */
  banner?: { js?: string };
  /** Use explicit file extensions: ESM → .mjs/.d.mts, CJS → .cjs/.d.cts */
  explicitExtensions?: boolean;
  /** Enable tree-shaking (default: false) */
  treeshake?: boolean;
  /** Disable code splitting (default: undefined, tsup decides) */
  splitting?: boolean;
  /** Use dts: true instead of dts: { resolve: true } (default: false) */
  simpleDts?: boolean;
  /** Disable sourcemaps (default: false — sourcemaps are ON by default) */
  noSourcemap?: boolean;
  /** ESM-only entry overrides (e.g. CLI bin entry only in ESM). If set, CJS uses `entry` and ESM uses this. */
  esmEntry?: Record<string, string> | string[];
}

/**
 * Create a standard dual ESM+CJS tsup config.
 *
 * Produces two builds:
 *   - ESM → dist/esm (clean: true)
 *   - CJS → dist/cjs (clean: false)
 *
 * @example Simple single-entry package
 * ```ts
 * import { createTsupConfig } from "../../config/tsup.base";
 * export default createTsupConfig({ entry: { index: "src/index.ts" } });
 * ```
 *
 * @example Multi-entry mechanism package
 * ```ts
 * export default createTsupConfig({
 *   entry: {
 *     index: "src/index.ts",
 *     "exact/client/index": "src/exact/client/index.ts",
 *   },
 * });
 * ```
 */
export function createTsupConfig(options: TsupConfigOptions) {
  const {
    entry,
    target = "es2020",
    external,
    banner,
    explicitExtensions = false,
    treeshake,
    splitting,
    simpleDts = false,
    noSourcemap = false,
    esmEntry,
  } = options;

  const shared: Partial<Options> = {
    dts: simpleDts ? true : { resolve: true },
    sourcemap: !noSourcemap,
    ...(target && { target }),
    ...(external && { external }),
    ...(treeshake !== undefined && { treeshake }),
    ...(splitting !== undefined && { splitting }),
  };

  const esmConfig: Options = {
    ...shared,
    entry: esmEntry ?? entry,
    format: ["esm"],
    outDir: "dist/esm",
    clean: true,
    ...(banner && { banner }),
    ...(explicitExtensions && {
      outExtension: () => ({ js: ".mjs", dts: ".d.mts" }),
    }),
  };

  const cjsConfig: Options = {
    ...shared,
    entry,
    format: ["cjs"],
    outDir: "dist/cjs",
    clean: false,
    ...(explicitExtensions && {
      outExtension: () => ({ js: ".cjs", dts: ".d.cts" }),
    }),
  };

  return defineConfig([esmConfig, cjsConfig]);
}

import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

interface VitestConfigOptions {
  /** Exclude integration tests from default run */
  excludeIntegration?: boolean;
  /** Custom exclude patterns (overrides default excludeIntegration behavior) */
  exclude?: string[];
  /** Enable v8 coverage reporting */
  coverage?: boolean;
  /** Custom coverage include patterns (default: general config file excludes) */
  coverageInclude?: string[];
  /** Custom coverage exclude patterns */
  coverageExclude?: string[];
  /** Test pool (default: vitest decides; use "forks" for isolation) */
  pool?: "threads" | "forks";
  /** Enable vitest globals (describe, it, expect without imports) */
  globals?: boolean;
  /** Set test environment (e.g. "node") */
  environment?: string;
  /** Custom test include patterns */
  include?: string[];
  /** Path aliases for cross-package resolution in tests */
  aliases?: Record<string, string>;
  /** Skip loadEnv — some packages don't need environment variable loading */
  noLoadEnv?: boolean;
  /** Skip vite-tsconfig-paths plugin */
  noTsconfigPaths?: boolean;
  /** Setup files to run before tests */
  setupFiles?: string[];
}

/**
 * Create a standard vitest config.
 *
 * By default includes env loading via loadEnv and tsconfig path resolution.
 *
 * @example Standard config (most packages)
 * ```ts
 * import { createVitestConfig } from "../../config/vitest.base";
 * export default createVitestConfig();
 * ```
 *
 * @example With integration test exclusion
 * ```ts
 * export default createVitestConfig({ excludeIntegration: true });
 * ```
 *
 * @example Mechanism package with coverage
 * ```ts
 * export default createVitestConfig({
 *   noLoadEnv: true,
 *   noTsconfigPaths: true,
 *   globals: true,
 *   environment: "node",
 *   include: ["test/*.test.ts"],
 *   excludeIntegration: true,
 *   coverage: true,
 *   coverageInclude: ["src/*.ts"],
 *   coverageExclude: ["src/*.d.ts"],
 * });
 * ```
 */
export function createVitestConfig(options?: VitestConfigOptions) {
  const {
    excludeIntegration = false,
    exclude,
    coverage = false,
    coverageInclude,
    coverageExclude,
    pool,
    globals,
    environment,
    include,
    aliases,
    noLoadEnv = false,
    noTsconfigPaths = false,
    setupFiles,
  } = options ?? {};

  const resolvedExclude = exclude
    ? exclude
    : excludeIntegration
      ? ["**/node_modules/**", "**/dist/**", "**/test/integrations/**"]
      : undefined;

  const defaultCoverageExclude = [
    "node_modules/**",
    "dist/**",
    "test/**",
    "**/*.config.ts",
    "**/*.d.ts",
  ];

  return defineConfig(({ mode }) => ({
    ...(aliases && {
      resolve: { alias: aliases },
    }),
    test: {
      ...(!noLoadEnv && { env: loadEnv(mode, process.cwd(), "") }),
      ...(resolvedExclude && { exclude: resolvedExclude }),
      ...(pool && { pool }),
      ...(globals && { globals }),
      ...(environment && { environment }),
      ...(include && { include }),
      ...(setupFiles && { setupFiles }),
      ...(coverage && {
        coverage: {
          provider: "v8" as const,
          reporter: ["text", "json", "html"],
          ...(coverageInclude && { include: coverageInclude }),
          exclude: coverageExclude ?? defaultCoverageExclude,
        },
      }),
    },
    ...(!noTsconfigPaths && {
      plugins: [tsconfigPaths({ projects: ["."] })],
    }),
  }));
}

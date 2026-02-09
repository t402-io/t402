import esbuild from "esbuild";
import { htmlPlugin } from "@craftamap/esbuild-plugin-html";
import fs from "fs";
import path from "path";
import { getBaseTemplate } from "../baseTemplate";
import { buildBrowserBundle, writeTemplates, type BuildConfig } from "../build-utils";

const config: BuildConfig = {
  network: "evm",
  entryPoint: "src/evm/entry.tsx",
  templateConstName: "EVM_PAYWALL_TEMPLATE",
  goConstName: "EVMPaywallTemplate",
};

// EVM-specific build - only bundles EVM dependencies
const DIST_DIR = "src/evm/dist";
const OUTPUT_HTML = path.join(DIST_DIR, "evm-paywall.html");

// Cross-language template output paths (relative to package root where build runs)
const PYTHON_DIR = path.join("..", "..", "..", "..", "python", "t402", "src", "t402");
const GO_DIR = path.join("..", "..", "..", "..", "go", "http");

const options: esbuild.BuildOptions = {
  entryPoints: ["src/evm/entry.tsx", "src/styles.css"],
  bundle: true,
  metafile: true,
  outdir: DIST_DIR,
  treeShaking: true,
  minify: true,
  format: "iife",
  sourcemap: false,
  platform: "browser",
  target: "es2020",
  jsx: "transform",
  define: {
    "process.env.NODE_ENV": '"production"',
    global: "globalThis",
    Buffer: "globalThis.Buffer",
  },
  mainFields: ["browser", "module", "main"],
  conditions: ["browser"],
  drop: ["debugger"],
  pure: ["console.log", "console.debug"],
  plugins: [
    htmlPlugin({
      files: [
        {
          entryPoints: ["src/evm/entry.tsx", "src/styles.css"],
          filename: "evm-paywall.html",
          title: "Payment Required",
          scriptLoading: "module",
          inline: {
            css: true,
            js: true,
          },
          htmlTemplate: getBaseTemplate(),
        },
      ],
    }),
  ],
  inject: ["./src/buffer-polyfill.ts"],
  external: ["crypto"],
};

async function build() {
  try {
    if (!fs.existsSync(DIST_DIR)) {
      fs.mkdirSync(DIST_DIR, { recursive: true });
    }

    const genDir = path.join("src/evm/gen");
    if (!fs.existsSync(genDir)) {
      fs.mkdirSync(genDir, { recursive: true });
    }

    // Build standalone browser bundle for CDN delivery
    await buildBrowserBundle(config);
    console.log("[EVM] Browser bundle built successfully!");

    // Build inline HTML template (existing behavior)
    await esbuild.build(options);
    console.log("[EVM] Inline HTML build completed!");

    if (fs.existsSync(OUTPUT_HTML)) {
      const inlineHtml = fs.readFileSync(OUTPUT_HTML, "utf8");

      // Write CDN + inline templates for TS, Python, Go
      writeTemplates(config, inlineHtml, {
        genDir,
        pythonDir: PYTHON_DIR,
        goDir: GO_DIR,
      });
    } else {
      throw new Error(`EVM bundled HTML not found at ${OUTPUT_HTML}`);
    }
  } catch (error) {
    console.error("[EVM] Build failed:", error);
    process.exit(1);
  }
}

build();

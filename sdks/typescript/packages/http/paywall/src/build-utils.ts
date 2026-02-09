/**
 * Shared build utilities for paywall template generation.
 * Used by all 7 network build scripts.
 */
import esbuild from "esbuild";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json at build time
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
const VERSION = pkg.version;

const CDN_BASE = `https://cdn.jsdelivr.net/npm/@t402/paywall@${VERSION}/dist/browser`;

export interface BuildConfig {
  /** Network identifier: "evm", "svm", "ton", "tron", "stacks", "cosmos", "near" */
  network: string;
  /** Entry point path relative to package root: "src/evm/entry.tsx" */
  entryPoint: string;
  /** Template constant name: "EVM_PAYWALL_TEMPLATE" */
  templateConstName: string;
  /** Go constant name: "EVMPaywallTemplate" */
  goConstName: string;
}

/**
 * Builds a standalone browser JS+CSS bundle (no HTML wrapping).
 * Output goes to dist/browser/{network}.min.{js,css}
 */
export async function buildBrowserBundle(config: BuildConfig): Promise<void> {
  const outdir = "dist/browser";
  if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir, { recursive: true });
  }

  await esbuild.build({
    entryPoints: [config.entryPoint, "src/styles.css"],
    bundle: true,
    outdir,
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
    inject: ["./src/buffer-polyfill.ts"],
    external: ["crypto"],
    // Name output files by network
    entryNames: config.network + ".min",
    assetNames: config.network + ".min",
  });

  // esbuild outputs entry.min.js for TSX and styles.min.css for CSS
  // Rename to network-based names
  const entryBase = path.basename(config.entryPoint, ".tsx");
  const jsFrom = path.join(outdir, `${entryBase}.min.js`);
  const jsTo = path.join(outdir, `${config.network}.min.js`);
  const cssFrom = path.join(outdir, "styles.min.css");
  const cssTo = path.join(outdir, `${config.network}.min.css`);

  if (fs.existsSync(jsFrom) && jsFrom !== jsTo) {
    fs.renameSync(jsFrom, jsTo);
  }
  if (fs.existsSync(cssFrom) && cssFrom !== cssTo) {
    // Copy CSS (multiple networks share styles.css, so copy instead of rename)
    fs.copyFileSync(cssFrom, cssTo);
  }
}

/**
 * Generates a lightweight CDN HTML shell template.
 */
export function generateCDNTemplate(config: BuildConfig, cdnBase?: string): string {
  const base = cdnBase || CDN_BASE;
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Required</title>
    <link rel="stylesheet" href="${base}/${config.network}.min.css">
</head>
<body>
    <div id="root"></div>
    <script src="${base}/${config.network}.min.js"></script>
</body>
</html>`;
}

/**
 * Writes CDN and inline template files for TypeScript, Python, and Go.
 */
export function writeTemplates(
  config: BuildConfig,
  inlineHtml: string,
  dirs: { genDir: string; pythonDir: string; goDir: string },
): void {
  const cdnHtml = generateCDNTemplate(config);
  const network = config.network.toUpperCase();

  // --- TypeScript ---
  // CDN template (default)
  const tsCdn = `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
/**
 * Lightweight CDN shell template for ${network} paywall.
 * JS/CSS loaded from jsDelivr CDN at runtime.
 */
export const ${config.templateConstName} = ${JSON.stringify(cdnHtml)};
`;
  // Inline template (fallback)
  const tsInline = `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT
/**
 * Full inline ${network} paywall template with all JS/CSS embedded.
 * Use deliveryMode: "inline" to enable this template.
 */
export const ${config.templateConstName}_INLINE = ${JSON.stringify(inlineHtml)};
`;

  fs.writeFileSync(path.join(dirs.genDir, "template.ts"), tsCdn);
  fs.writeFileSync(path.join(dirs.genDir, "template-inline.ts"), tsInline);
  console.log(`[${network}] CDN template: ${cdnHtml.length} bytes`);
  console.log(`[${network}] Inline template: ${(inlineHtml.length / 1024 / 1024).toFixed(2)} MB`);

  // --- Python ---
  if (fs.existsSync(dirs.pythonDir)) {
    const pyPrefix = config.network.toLowerCase();
    // CDN (default)
    fs.writeFileSync(
      path.join(dirs.pythonDir, `${pyPrefix}_paywall_template.py`),
      `# THIS FILE IS AUTO-GENERATED - DO NOT EDIT\n${config.templateConstName} = ${JSON.stringify(cdnHtml)}\n`,
    );
    // Inline
    fs.writeFileSync(
      path.join(dirs.pythonDir, `${pyPrefix}_paywall_template_inline.py`),
      `# THIS FILE IS AUTO-GENERATED - DO NOT EDIT\n${config.templateConstName}_INLINE = ${JSON.stringify(inlineHtml)}\n`,
    );
    console.log(`[${network}] Generated Python templates`);
  }

  // --- Go ---
  if (fs.existsSync(dirs.goDir)) {
    const goPrefix = config.network.toLowerCase();
    // CDN (default)
    fs.writeFileSync(
      path.join(dirs.goDir, `${goPrefix}_paywall_template.go`),
      `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT\npackage http\n\n// ${config.goConstName} is the CDN shell template for ${network} paywall\nconst ${config.goConstName} = ${JSON.stringify(cdnHtml)}\n`,
    );
    // Inline
    fs.writeFileSync(
      path.join(dirs.goDir, `${goPrefix}_paywall_template_inline.go`),
      `// THIS FILE IS AUTO-GENERATED - DO NOT EDIT\npackage http\n\n// ${config.goConstName}Inline is the full inline template for ${network} paywall\nconst ${config.goConstName}Inline = ${JSON.stringify(inlineHtml)}\n`,
    );
    console.log(`[${network}] Generated Go templates`);
  }
}

export { VERSION };

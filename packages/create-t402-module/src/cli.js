#!/usr/bin/env node

/**
 * create-t402-module — Scaffold new t402 modules
 *
 * Usage:
 *   npx create-t402-module mechanism sui
 *   npx create-t402-module extension my-extension
 *   npx create-t402-module mcp-tool my-tool
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const [,, type, name] = process.argv;

if (!type || !name) {
  console.log(`
create-t402-module — Scaffold new t402 modules

Usage:
  npx create-t402-module mechanism <chain>      Create payment mechanism
  npx create-t402-module extension <name>       Create protocol extension
  npx create-t402-module mcp-tool <name>        Create MCP tool

Examples:
  npx create-t402-module mechanism sui
  npx create-t402-module extension my-auth
  npx create-t402-module mcp-tool check-nft
`);
  process.exit(0);
}

function scaffold(files) {
  for (const [path, content] of Object.entries(files)) {
    const dir = join(path, "..");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, content);
    console.log(`  ✅ ${path}`);
  }
}

console.log(`\n🔨 Creating t402 ${type}: ${name}\n`);

if (type === "mechanism") {
  const pascal = name.charAt(0).toUpperCase() + name.slice(1);
  const dir = `t402-mechanism-${name}`;

  scaffold({
    [`${dir}/src/types.ts`]: `/**
 * ${pascal} payment mechanism types.
 * Network: ${name}:mainnet
 */

export const SCHEME_EXACT = "exact";
export const NETWORK_MAINNET = "${name}:mainnet";
export const NETWORK_TESTNET = "${name}:testnet";

export interface ${pascal}Payload {
  transaction: string;
  sender: string;
}

export interface ${pascal}Signer {
  getAddress(): string;
  signTransaction(tx: unknown): Promise<string>;
  sendTransaction(signedTx: string): Promise<string>;
  confirmTransaction(txHash: string): Promise<{ status: "success" | "failed" }>;
}
`,
    [`${dir}/src/exact/client/scheme.ts`]: `import type { ${pascal}Payload } from "../../types";

export class ${pascal}ClientScheme {
  readonly scheme = "exact";

  async createPaymentPayload(t402Version: number, requirements: any) {
    // TODO: Build and sign ${name} transaction
    const payload: ${pascal}Payload = {
      transaction: "",
      sender: "",
    };
    return { t402Version, payload };
  }
}
`,
    [`${dir}/src/exact/facilitator/scheme.ts`]: `import type { ${pascal}Signer } from "../../types";

export class ${pascal}FacilitatorScheme {
  readonly scheme = "exact";
  readonly caipFamily = "${name}:*";

  constructor(private signer: ${pascal}Signer) {}

  async verify(payload: any, requirements: any) {
    // TODO: Verify ${name} transaction
    return { isValid: true, payer: "" };
  }

  async settle(payload: any, requirements: any) {
    const result = await this.verify(payload, requirements);
    if (!result.isValid) return { success: false };
    // TODO: Submit/confirm ${name} transaction
    return { success: true, transaction: "", payer: result.payer };
  }
}
`,
    [`${dir}/src/index.ts`]: `export * from "./types";
export { ${pascal}ClientScheme } from "./exact/client/scheme";
export { ${pascal}FacilitatorScheme } from "./exact/facilitator/scheme";
`,
    [`${dir}/test/facilitator.test.ts`]: `import { describe, it, expect } from "vitest";

describe("${pascal}FacilitatorScheme", () => {
  it("should have correct scheme", () => {
    // TODO: Add tests
    expect(true).toBe(true);
  });
});
`,
    [`${dir}/package.json`]: JSON.stringify({
      name: `@t402/${name}`,
      version: "2.8.0",
      description: `${pascal} payment mechanism for t402`,
      main: "./dist/cjs/index.js",
      module: "./dist/esm/index.js",
      scripts: { build: "tsup", test: "vitest run --pool=forks" },
      dependencies: { "@t402/core": "workspace:*" },
      devDependencies: { tsup: "^8.0.0", typescript: "^5.9.0", vitest: "^3.2.0" },
    }, null, 2),
  });

} else if (type === "extension") {
  const dir = `t402-extension-${name}`;
  scaffold({
    [`${dir}/src/types.ts`]: `export const EXTENSION_KEY = "${name}";\n\nexport interface ${name.replace(/-/g, "")}Extension {\n  // TODO: Define extension fields\n}\n`,
    [`${dir}/src/index.ts`]: `export * from "./types";\n`,
    [`${dir}/test/extension.test.ts`]: `import { describe, it, expect } from "vitest";\nimport { EXTENSION_KEY } from "../src/types";\n\ndescribe("${name} extension", () => {\n  it("should have correct key", () => {\n    expect(EXTENSION_KEY).toBe("${name}");\n  });\n});\n`,
    [`${dir}/package.json`]: JSON.stringify({
      name: `@t402/ext-${name}`,
      version: "2.8.0",
      scripts: { build: "tsup", test: "vitest run" },
      dependencies: { "@t402/core": "workspace:*" },
    }, null, 2),
  });

} else if (type === "mcp-tool") {
  const camel = name.replace(/-(\w)/g, (_, c) => c.toUpperCase());
  const dir = `t402-mcp-${name}`;
  scaffold({
    [`${dir}/${camel}.ts`]: `import { z } from "zod";

export const ${camel}InputSchema = z.object({
  // TODO: Define input parameters
});

export type ${camel.charAt(0).toUpperCase() + camel.slice(1)}Input = z.infer<typeof ${camel}InputSchema>;

export async function execute${camel.charAt(0).toUpperCase() + camel.slice(1)}(input: ${camel.charAt(0).toUpperCase() + camel.slice(1)}Input) {
  // TODO: Implement tool logic
  return { success: true };
}

export function format${camel.charAt(0).toUpperCase() + camel.slice(1)}Result(result: any): string {
  return JSON.stringify(result, null, 2);
}
`,
  });

} else {
  console.error(`Unknown type: ${type}. Use: mechanism, extension, mcp-tool`);
  process.exit(1);
}

console.log(`\n✅ Done! cd into the directory and start building.\n`);

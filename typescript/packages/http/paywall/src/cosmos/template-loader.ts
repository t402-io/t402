/**
 * Lazy loader for Cosmos paywall template
 * The template is generated during build via `pnpm build:paywall`
 */

let cachedTemplate: string | null = null;

/**
 * Get the Cosmos paywall template HTML.
 * Returns null if the template has not been generated yet.
 *
 * @returns The template HTML string or null
 */
export function getCosmosTemplate(): string | null {
  if (cachedTemplate !== null) {
    return cachedTemplate;
  }

  try {
    // Dynamic import to handle cases where template hasn't been built
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { COSMOS_PAYWALL_TEMPLATE } = require("./gen/template");
    cachedTemplate = COSMOS_PAYWALL_TEMPLATE;
    return cachedTemplate;
  } catch {
    // Template not yet generated - return null
    return null;
  }
}

/**
 * Lazy loader for the Stacks paywall HTML template.
 * The template is generated at build time via `pnpm build:paywall`
 */

let cachedTemplate: string | null = null;

/**
 * Get the Stacks paywall HTML template
 *
 * @returns HTML template string or null if not built yet
 */
export function getStacksTemplate(): string | null {
  if (cachedTemplate) {
    return cachedTemplate;
  }

  try {
    // Dynamic require to avoid bundling issues
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const templateModule = require("./gen/template");
    cachedTemplate = templateModule.STACKS_PAYWALL_TEMPLATE;
    return cachedTemplate;
  } catch {
    // Template not built yet - this is expected during development
    return null;
  }
}

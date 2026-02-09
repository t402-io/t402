let cachedCdnTemplate: string | null = null;
let cachedInlineTemplate: string | null = null;

/**
 * Loads the Stacks paywall template.
 *
 * @param mode - "cdn" for lightweight CDN shell (default), "inline" for full embedded HTML
 * @returns The template HTML string, or null if not found
 */
export function getStacksTemplate(mode: "cdn" | "inline" = "cdn"): string | null {
  if (mode === "inline") {
    if (cachedInlineTemplate !== null) {
      return cachedInlineTemplate;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const template = require("./gen/template-inline");
      cachedInlineTemplate = template.STACKS_PAYWALL_TEMPLATE_INLINE;
      return cachedInlineTemplate;
    } catch {
      return null;
    }
  }

  if (cachedCdnTemplate !== null) {
    return cachedCdnTemplate;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const template = require("./gen/template");
    cachedCdnTemplate = template.STACKS_PAYWALL_TEMPLATE;
    return cachedCdnTemplate;
  } catch {
    return null;
  }
}

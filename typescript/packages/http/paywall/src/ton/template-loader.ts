let cachedTemplate: string | null = null;

export function getTonTemplate(): string | null {
  if (cachedTemplate !== null) {
    return cachedTemplate;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const template = require("./gen/template");
    cachedTemplate = template.TON_PAYWALL_TEMPLATE;
    return cachedTemplate;
  } catch {
    return null;
  }
}

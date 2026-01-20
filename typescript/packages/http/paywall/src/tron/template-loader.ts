let cachedTemplate: string | null = null;

export function getTronTemplate(): string | null {
  if (cachedTemplate !== null) {
    return cachedTemplate;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const template = require("./gen/template");
    cachedTemplate = template.TRON_PAYWALL_TEMPLATE;
    return cachedTemplate;
  } catch {
    return null;
  }
}

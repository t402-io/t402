import type { OpenNextConfig } from "@opennextjs/cloudflare";

export default {
  // Cloudflare Pages deployment settings
  dangerous: {
    // Allow experimental features for Next.js 16
    enableCacheInterception: true,
  },
} satisfies OpenNextConfig;

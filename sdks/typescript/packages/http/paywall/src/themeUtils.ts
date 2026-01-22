import type { PaywallTheme } from "./types";

/**
 * Generates the theme injection script for the paywall HTML.
 * This script applies dark mode and custom CSS variables at runtime.
 *
 * @param theme - Theme configuration
 * @returns Script string to inject into HTML
 */
export function generateThemeScript(theme?: PaywallTheme): string {
  if (!theme) {
    return "";
  }

  const themeConfig = JSON.stringify(theme);

  return `
  <script>
    (function() {
      var theme = ${themeConfig};
      var root = document.documentElement;

      // Apply dark mode
      if (theme.mode === 'dark' ||
          (theme.mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark');
      }

      // Listen for system theme changes when mode is 'auto'
      if (theme.mode === 'auto') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
          if (e.matches) {
            root.classList.add('dark');
          } else {
            root.classList.remove('dark');
          }
        });
      }

      // Apply custom colors
      if (theme.colors) {
        if (theme.colors.primary) {
          root.style.setProperty('--button-primary-color', theme.colors.primary);
        }
        if (theme.colors.background) {
          root.style.setProperty('--background-color', theme.colors.background);
        }
        if (theme.colors.containerBackground) {
          root.style.setProperty('--container-background-color', theme.colors.containerBackground);
        }
        if (theme.colors.text) {
          root.style.setProperty('--text-color', theme.colors.text);
        }
        if (theme.colors.secondaryText) {
          root.style.setProperty('--secondary-text-color', theme.colors.secondaryText);
        }
        if (theme.colors.border) {
          root.style.setProperty('--border-color', theme.colors.border);
        }
      }

      // Apply border radius
      if (theme.borderRadius) {
        root.style.setProperty('--container-border-radius', theme.borderRadius);
      }

      // Apply font family
      if (theme.fontFamily) {
        root.style.setProperty('--font-family', theme.fontFamily);
        document.body.style.fontFamily = theme.fontFamily;
      }
    })();
  </script>`;
}

/**
 * T402 Design System Tokens
 *
 * A comprehensive design token system for the t402.io website.
 * Uses Tether-inspired green as the primary brand color with a dark theme.
 */

// =============================================================================
// COLORS
// =============================================================================

export const colors = {
  // Background colors (dark theme)
  background: {
    primary: '#0A0A0B',      // Main background - near black
    secondary: '#111113',    // Elevated surfaces (cards, modals)
    tertiary: '#18181B',     // Input backgrounds, code blocks
    elevated: '#232326',     // Popovers, dropdowns
    inverse: '#FAFAFA',      // Light background for contrast sections
  },

  // Text colors
  text: {
    primary: '#FAFAFA',      // Primary text - near white
    secondary: '#A1A1AA',    // Secondary text - muted
    tertiary: '#71717A',     // Tertiary text - more muted
    inverse: '#0A0A0B',      // Text on light backgrounds
    link: '#50AF95',         // Link color - brand green
  },

  // Brand colors - Tether inspired
  brand: {
    primary: '#50AF95',      // Primary brand - Tether green
    secondary: '#26A17B',    // Secondary brand - darker green
    accent: '#1BA27A',       // Accent - hover/active states
    muted: 'rgba(80, 175, 149, 0.1)', // Muted brand for backgrounds
  },

  // Semantic colors
  semantic: {
    success: '#22C55E',      // Success - green
    warning: '#F59E0B',      // Warning - amber
    error: '#EF4444',        // Error - red
    info: '#3B82F6',         // Info - blue
  },

  // Chain-specific colors
  chains: {
    ethereum: '#627EEA',
    base: '#0052FF',
    arbitrum: '#28A0F0',
    optimism: '#FF0420',
    polygon: '#8247E5',
    ton: '#0098EA',
    tron: '#FF0000',
    solana: '#9945FF',
    berachain: '#FF6B00',
    unichain: '#FF007A',
    ink: '#7B3FE4',
  },

  // Border colors
  border: {
    primary: '#27272A',      // Default borders
    secondary: '#3F3F46',    // Emphasized borders
    tertiary: '#52525B',     // Strong borders
    focus: '#50AF95',        // Focus ring color
    muted: 'rgba(255, 255, 255, 0.1)', // Subtle borders
  },

  // Overlay colors
  overlay: {
    light: 'rgba(255, 255, 255, 0.05)',
    medium: 'rgba(255, 255, 255, 0.1)',
    dark: 'rgba(0, 0, 0, 0.5)',
    backdrop: 'rgba(0, 0, 0, 0.8)',
  },
} as const;

// =============================================================================
// TYPOGRAPHY
// =============================================================================

export const typography = {
  // Font families
  fonts: {
    sans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    mono: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
    display: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  },

  // Font sizes (in rem)
  sizes: {
    xs: '0.75rem',     // 12px
    sm: '0.875rem',    // 14px
    base: '1rem',      // 16px
    lg: '1.125rem',    // 18px
    xl: '1.25rem',     // 20px
    '2xl': '1.5rem',   // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
    '5xl': '3rem',     // 48px
    '6xl': '3.75rem',  // 60px
    '7xl': '4.5rem',   // 72px
  },

  // Line heights
  lineHeights: {
    none: '1',
    tight: '1.25',
    snug: '1.375',
    normal: '1.5',
    relaxed: '1.625',
    loose: '2',
  },

  // Font weights
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Letter spacing
  tracking: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
} as const;

// =============================================================================
// SPACING
// =============================================================================

export const spacing = {
  0: '0',
  px: '1px',
  0.5: '0.125rem',   // 2px
  1: '0.25rem',      // 4px
  1.5: '0.375rem',   // 6px
  2: '0.5rem',       // 8px
  2.5: '0.625rem',   // 10px
  3: '0.75rem',      // 12px
  3.5: '0.875rem',   // 14px
  4: '1rem',         // 16px
  5: '1.25rem',      // 20px
  6: '1.5rem',       // 24px
  7: '1.75rem',      // 28px
  8: '2rem',         // 32px
  9: '2.25rem',      // 36px
  10: '2.5rem',      // 40px
  11: '2.75rem',     // 44px
  12: '3rem',        // 48px
  14: '3.5rem',      // 56px
  16: '4rem',        // 64px
  20: '5rem',        // 80px
  24: '6rem',        // 96px
  28: '7rem',        // 112px
  32: '8rem',        // 128px
  36: '9rem',        // 144px
  40: '10rem',       // 160px
} as const;

// =============================================================================
// LAYOUT
// =============================================================================

export const layout = {
  // Max widths
  maxWidth: {
    xs: '20rem',       // 320px
    sm: '24rem',       // 384px
    md: '28rem',       // 448px
    lg: '32rem',       // 512px
    xl: '36rem',       // 576px
    '2xl': '42rem',    // 672px
    '3xl': '48rem',    // 768px
    '4xl': '56rem',    // 896px
    '5xl': '64rem',    // 1024px
    '6xl': '72rem',    // 1152px
    '7xl': '80rem',    // 1280px
    container: '90rem', // 1440px
    full: '100%',
  },

  // Breakpoints (min-width)
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    '2xl': '1536px',
  },

  // Z-index layers
  zIndex: {
    hide: -1,
    base: 0,
    docked: 10,
    dropdown: 1000,
    sticky: 1100,
    banner: 1200,
    overlay: 1300,
    modal: 1400,
    popover: 1500,
    toast: 1600,
    tooltip: 1700,
  },
} as const;

// =============================================================================
// BORDERS & RADIUS
// =============================================================================

export const borders = {
  // Border radius
  radius: {
    none: '0',
    sm: '0.125rem',    // 2px
    default: '0.25rem', // 4px
    md: '0.375rem',    // 6px
    lg: '0.5rem',      // 8px
    xl: '0.75rem',     // 12px
    '2xl': '1rem',     // 16px
    '3xl': '1.5rem',   // 24px
    full: '9999px',
  },

  // Border widths
  width: {
    0: '0',
    1: '1px',
    2: '2px',
    4: '4px',
    8: '8px',
  },
} as const;

// =============================================================================
// SHADOWS
// =============================================================================

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
  default: '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.4)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.3)',
  // Glow effects for brand elements
  glow: {
    sm: '0 0 10px rgba(80, 175, 149, 0.3)',
    md: '0 0 20px rgba(80, 175, 149, 0.4)',
    lg: '0 0 30px rgba(80, 175, 149, 0.5)',
  },
} as const;

// =============================================================================
// MOTION / ANIMATION
// =============================================================================

export const motion = {
  // Durations
  duration: {
    instant: '0ms',
    fast: '100ms',
    normal: '200ms',
    slow: '300ms',
    slower: '500ms',
    slowest: '700ms',
  },

  // Easing functions
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    linear: 'linear',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
  },
} as const;

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type Layout = typeof layout;
export type Borders = typeof borders;
export type Shadows = typeof shadows;
export type Motion = typeof motion;

// Combined tokens export
export const tokens = {
  colors,
  typography,
  spacing,
  layout,
  borders,
  shadows,
  motion,
} as const;

export type Tokens = typeof tokens;
export default tokens;

import type { DocsThemeConfig } from 'nextra-theme-docs'
import { useRouter } from 'nextra/hooks'
import { DocSearch } from '@docsearch/react'
import '@docsearch/css'

/**
 * Algolia DocSearch configuration
 *
 * To enable Algolia search:
 * 1. Apply for DocSearch at https://docsearch.algolia.com/apply/
 * 2. Or create your own Algolia account and index
 * 3. Set the following environment variables:
 *    - NEXT_PUBLIC_ALGOLIA_APP_ID
 *    - NEXT_PUBLIC_ALGOLIA_API_KEY (search-only key)
 *    - NEXT_PUBLIC_ALGOLIA_INDEX_NAME
 */
const ALGOLIA_APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID
const ALGOLIA_API_KEY = process.env.NEXT_PUBLIC_ALGOLIA_API_KEY
const ALGOLIA_INDEX_NAME = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME

/**
 * T402 gem icon SVG — matches the t402.io brand mark.
 *
 * @returns SVG element for the T402 gem logo
 */
function T402GemIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M60 10L105 40V80L60 110L15 80V40L60 10Z"
        fill="#50AF95"
        fillOpacity={0.12}
        stroke="#50AF95"
        strokeWidth={4}
      />
      <path
        d="M60 10L105 40L60 55L15 40L60 10Z"
        fill="#50AF95"
        fillOpacity={0.25}
      />
      <path
        d="M60 55V110L15 80V40L60 55Z"
        fill="#50AF95"
        fillOpacity={0.18}
      />
      <path
        d="M60 55V110L105 80V40L60 55Z"
        fill="#50AF95"
        fillOpacity={0.08}
      />
    </svg>
  )
}

const config: DocsThemeConfig = {
  // --- Brand Colors ---
  color: {
    hue: { dark: 160, light: 160 },
    saturation: { dark: 40, light: 40 },
    lightness: { dark: 50, light: 35 },
  },
  backgroundColor: {
    dark: '10,10,11',
    light: '250,250,250',
  },

  // --- Logo ---
  logo: (
    <span style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    }}>
      <T402GemIcon />
      <span style={{
        fontWeight: 800,
        fontSize: '1.3rem',
        color: '#50AF95',
        letterSpacing: '-0.02em',
      }}>
        T402
      </span>
      <span style={{
        fontSize: '0.6875rem',
        fontWeight: 500,
        color: 'var(--nextra-fg, #71717A)',
        opacity: 0.6,
        marginLeft: '0.125rem',
        letterSpacing: '0.04em',
        textTransform: 'uppercase' as const,
      }}>
        Docs
      </span>
    </span>
  ),

  // --- Banner ---
  banner: {
    key: 'v2.8.0-stellar',
    dismissible: true,
    content: (
      <a href="/changelog" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem' }}>
        <span style={{ fontWeight: 600 }}>T402 v2.8.0</span>
        <span style={{ opacity: 0.5 }}>&mdash;</span>
        <span>Stellar support + 39 packages across 45 networks</span>
        <span style={{ marginLeft: '0.25rem', opacity: 0.7 }}>&rarr;</span>
      </a>
    ),
  },

  // --- Navbar ---
  navbar: {
    extraContent: (
      <a
        href="/getting-started/quickstart"
        className="t402-nav-cta"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.375rem 0.875rem',
          fontSize: '0.8125rem',
          fontWeight: 600,
          color: '#0A0A0B',
          background: '#50AF95',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          transition: 'opacity 200ms',
          marginLeft: '0.5rem',
        }}
      >
        Get Started
      </a>
    ),
  },

  // --- Project & Social Links ---
  project: {
    link: 'https://github.com/t402-io/t402'
  },
  chat: {
    link: 'https://x.com/t402_io',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    )
  },

  // --- Search ---
  // Algolia DocSearch - renders custom search if credentials are configured
  search: {
    component: ALGOLIA_APP_ID && ALGOLIA_API_KEY && ALGOLIA_INDEX_NAME
      ? () => (
          <DocSearch
            appId={ALGOLIA_APP_ID}
            apiKey={ALGOLIA_API_KEY}
            indexName={ALGOLIA_INDEX_NAME}
          />
        )
      : undefined // Falls back to Nextra's built-in search
  },

  // --- Repository ---
  docsRepositoryBase: 'https://github.com/t402-io/t402/tree/main/services/docs',

  // --- Footer ---
  footer: {
    content: (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.75rem',
        width: '100%',
        padding: '0.5rem 0',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M60 10L105 40V80L60 110L15 80V40L60 10Z"
              fill="#50AF95"
              fillOpacity={0.2}
              stroke="#50AF95"
              strokeWidth={4}
            />
          </svg>
          <span style={{
            fontWeight: 700,
            fontSize: '0.875rem',
            color: '#50AF95',
          }}>
            T402
          </span>
        </div>
        <span style={{
          fontSize: '0.8125rem',
          opacity: 0.5,
        }}>
          &copy; {new Date().getFullYear()} T402 &middot; The Official Payment Protocol for USDT
        </span>
      </div>
    )
  },

  // --- Head ---
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="T402 - The Official Payment Protocol for USDT" />
      <meta property="og:title" content="T402 Documentation" />
      <meta property="og:description" content="HTTP-native stablecoin payments for USDT and USDT0" />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <link rel="icon" type="image/x-icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="96x96" href="/favicon-96x96.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    </>
  ),

  // --- Sidebar ---
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },

  // --- Table of Contents ---
  toc: {
    backToTop: true
  },

  // --- Edit Link ---
  editLink: {
    content: 'Edit this page on GitHub'
  },

  // --- Feedback ---
  feedback: {
    content: 'Question? Give us feedback',
    labels: 'documentation'
  },

  // --- Navigation ---
  navigation: {
    prev: true,
    next: true
  },

  // --- Git Timestamp ---
  gitTimestamp: ({ timestamp }) => (
    <span>Last updated: {timestamp.toLocaleDateString()}</span>
  )
}

export default config

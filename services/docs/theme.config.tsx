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

const config: DocsThemeConfig = {
  logo: (
    <span style={{
      fontWeight: 800,
      fontSize: '1.3rem',
      background: 'linear-gradient(135deg, #00D632 0%, #00A3FF 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    }}>
      T402
    </span>
  ),
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
  docsRepositoryBase: 'https://github.com/t402-io/t402/tree/main/docs',
  footer: {
    content: (
      <span>
        {new Date().getFullYear()} T402. The Official Payment Protocol for USDT.
      </span>
    )
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="T402 - The Official Payment Protocol for USDT" />
      <meta property="og:title" content="T402 Documentation" />
      <meta property="og:description" content="HTTP-native stablecoin payments for USDT and USDT0" />
      <link rel="icon" href="/favicon.ico" />
    </>
  ),
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true
  },
  toc: {
    backToTop: true
  },
  editLink: {
    content: 'Edit this page on GitHub'
  },
  feedback: {
    content: 'Question? Give us feedback',
    labels: 'documentation'
  },
  navigation: {
    prev: true,
    next: true
  },
  gitTimestamp: ({ timestamp }) => (
    <span>Last updated: {timestamp.toLocaleDateString()}</span>
  )
}

export default config

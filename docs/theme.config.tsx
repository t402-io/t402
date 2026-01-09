import type { DocsThemeConfig } from 'nextra-theme-docs'

const config: DocsThemeConfig = {
  logo: (
    <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>
      T402
    </span>
  ),
  project: {
    link: 'https://github.com/t402-io/t402'
  },
  chat: {
    link: 'https://twitter.com/t402_io'
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

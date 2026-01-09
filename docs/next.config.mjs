import nextra from 'nextra'

const withNextra = nextra({
  theme: 'nextra-theme-docs',
  themeConfig: './theme.config.tsx',
  defaultShowCopyCode: true,
  search: {
    codeblocks: true
  }
})

export default withNextra({
  reactStrictMode: true,
  images: {
    unoptimized: true
  }
})

import { useEffect, useRef, useState, useCallback } from 'react'

interface PagefindResult {
  url: string
  meta?: { title?: string }
  excerpt?: string
}

interface PagefindSearchResult {
  id: string
  data: () => Promise<PagefindResult>
}

interface PagefindInstance {
  init: () => Promise<void>
  search: (query: string) => Promise<{ results: PagefindSearchResult[] }>
}

export default function PagefindSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PagefindResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [pagefind, setPagefind] = useState<PagefindInstance | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadPagefind() {
      try {
        const pf = await import(
          // @ts-expect-error pagefind is loaded from static assets
          /* webpackIgnore: true */ '/pagefind/pagefind.js'
        )
        await pf.init()
        setPagefind(pf)
      } catch {
        // Pagefind not available (dev mode)
      }
    }
    loadPagefind()
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
        setResults([])
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  const doSearch = useCallback(
    async (q: string) => {
      if (!pagefind || q.length < 2) {
        setResults([])
        return
      }
      const search = await pagefind.search(q)
      const data = await Promise.all(
        search.results.slice(0, 8).map((r) => r.data())
      )
      setResults(data)
    },
    [pagefind]
  )

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 150)
    return () => clearTimeout(timer)
  }, [query, doSearch])

  function handleSelect(url: string) {
    setIsOpen(false)
    setQuery('')
    setResults([])
    window.location.href = url
  }

  return (
    <>
      <button
        onClick={() => {
          setIsOpen(true)
          setTimeout(() => inputRef.current?.focus(), 50)
        }}
        className="nextra-search-button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.375rem 0.75rem',
          fontSize: '0.8125rem',
          color: 'var(--nextra-fg)',
          opacity: 0.6,
          border: '1px solid var(--nextra-border)',
          borderRadius: '0.5rem',
          background: 'transparent',
          cursor: 'pointer',
          minWidth: '200px',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>Search docs...</span>
        <kbd style={{
          marginLeft: 'auto',
          fontSize: '0.6875rem',
          padding: '0.125rem 0.375rem',
          borderRadius: '0.25rem',
          border: '1px solid var(--nextra-border)',
          opacity: 0.5,
        }}>
          ⌘K
        </kbd>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '15vh',
            background: 'rgba(0,0,0,0.5)',
          }}
        >
          <div
            ref={containerRef}
            style={{
              width: '100%',
              maxWidth: '560px',
              margin: '0 1rem',
              background: 'var(--nextra-bg-secondary, #1a1a1b)',
              borderRadius: '0.75rem',
              border: '1px solid var(--nextra-border)',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
              overflow: 'hidden',
            }}
          >
            <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--nextra-border)' }}>
              <input
                ref={inputRef}
                type="text"
                placeholder="Search documentation..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.9375rem',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--nextra-fg)',
                }}
              />
            </div>
            {results.length > 0 && (
              <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '0.5rem' }}>
                {results.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelect(r.url)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.625rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--nextra-fg)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(80,175,149,0.08)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                      {r.meta?.title || r.url}
                    </div>
                    {r.excerpt && (
                      <div
                        style={{ fontSize: '0.75rem', opacity: 0.6, marginTop: '0.25rem' }}
                        dangerouslySetInnerHTML={{ __html: r.excerpt }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
            {query.length >= 2 && results.length === 0 && (
              <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.5, fontSize: '0.875rem' }}>
                {pagefind ? 'No results found.' : 'Search is loading...'}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

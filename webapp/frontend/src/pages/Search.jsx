import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const urlQuery = searchParams.get('query') || ''
  const [query, setQuery] = useState(urlQuery)
  const [iframeLoading, setIframeLoading] = useState(false)
  const searchInputRef = useRef(null)

  // Trigger search when query param in URL changes
  useEffect(() => {
    if (urlQuery.trim()) {
      setQuery(urlQuery)
      setIframeLoading(true)
    }
  }, [urlQuery])

  // Sync Telegram Web App BackButton
  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (webApp) {
      webApp.BackButton.show()
      const handleBack = () => {
        navigate(-1)
      }
      webApp.BackButton.onClick(handleBack)
      return () => {
        webApp.BackButton.offClick(handleBack)
      }
    }
  }, [navigate])

  const handleSearchSubmit = (e) => {
    e?.preventDefault()
    if (query.trim()) {
      setSearchParams({ query: query.trim() })
    }
  }

  const handleIframeLoad = () => {
    setIframeLoading(false)
  }

  return (
    <div className="page search-page animate-fade-in" style={{ paddingBottom: '0px', display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header with search bar */}
      <div className="header" style={{ padding: '8px 12px', height: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
        <button className="header__back" onClick={() => navigate(-1)} style={{ marginRight: '4px' }}>
          <span className="icon" style={{ fontSize: '24px' }}>‹</span>
        </button>
        
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, gap: '6px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              ref={searchInputRef}
              type="text"
              className="input search-input"
              style={{
                width: '100%',
                padding: '10px 36px 10px 12px',
                fontSize: '14px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--card-border)',
                color: 'var(--text)'
              }}
              placeholder="Поиск подарка..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '16px',
                  cursor: 'pointer',
                  padding: '2px'
                }}
              >
                ×
              </button>
            )}
          </div>
          <button 
            type="submit"
            className="btn btn--primary"
            style={{
              width: '42px',
              height: '42px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'none'
            }}
          >
            🔎
          </button>
        </form>
      </div>

      {/* Main content container */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', overflow: 'hidden' }}>
        {urlQuery ? (
          <div style={{ position: 'relative', width: '100%', flex: 1, overflow: 'hidden' }}>
            {iframeLoading && (
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#0a0a0c', // Matches premium dark mode of the app
                zIndex: 10
              }}>
                <div className="spinner" style={{ width: '40px', height: '40px', borderWidth: '3px', marginBottom: '16px' }} />
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Подключаемся к Яндекс Маркету...</div>
              </div>
            )}
            <iframe
              src={`/api/market/webview?query=${encodeURIComponent(urlQuery)}`}
              title="Yandex Market"
              style={{
                width: '100%',
                height: '100%',
                border: 'none',
                background: 'var(--bg)'
              }}
              onLoad={handleIframeLoad}
            />
          </div>
        ) : (
          /* Empty state / Prompt to search */
          <div style={{ padding: '0 16px', marginTop: '40px', flex: 1 }}>
            <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '56px', marginBottom: '20px' }}>🎁</div>
              <div className="empty-state__title" style={{ fontSize: '20px', fontWeight: '800', letterSpacing: '-0.5px', color: 'var(--text)' }}>
                Ищите подарки напрямую
              </div>
              <div className="empty-state__desc" style={{ maxWidth: '280px', margin: '10px auto 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
                Введите название товара или категорию выше, и мы откроем Яндекс Маркет прямо внутри приложения через безопасное соединение.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const urlQuery = searchParams.get('query') || ''
  const [query, setQuery] = useState(urlQuery)
  const [marketplace, setMarketplace] = useState('yandex') // 'yandex' or 'ozon'
  const [iframeLoading, setIframeLoading] = useState(false)
  const searchInputRef = useRef(null)

  // Trigger search when query param in URL changes or marketplace changes
  useEffect(() => {
    if (urlQuery.trim()) {
      setQuery(urlQuery)
      setIframeLoading(true)
    }
  }, [urlQuery, marketplace])

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
    <div className="page search-page animate-fade-in" style={{ paddingBottom: '0px', display: 'flex', flexDirection: 'column', height: '100vh', paddingLeft: '0px', paddingRight: '0px', paddingTop: '0px' }}>
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

      {/* Marketplace Selector Tabs */}
      <div style={{ display: 'flex', gap: '8px', padding: '0 16px 12px 16px', background: 'var(--bg)', flexShrink: 0, borderBottom: '1px solid var(--card-border)' }}>
        <button
          onClick={() => setMarketplace('yandex')}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: 'var(--radius-sm)',
            border: marketplace === 'yandex' ? '1px solid var(--accent)' : '1px solid var(--card-border)',
            background: marketplace === 'yandex' ? 'rgba(108, 92, 231, 0.12)' : 'rgba(255,255,255,0.02)',
            color: marketplace === 'yandex' ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textAlign: 'center'
          }}
        >
          🇷🇺 Яндекс Маркет
        </button>
        <button
          onClick={() => setMarketplace('ozon')}
          style={{
            flex: 1,
            padding: '8px 12px',
            fontSize: '13px',
            fontWeight: '700',
            borderRadius: 'var(--radius-sm)',
            border: marketplace === 'ozon' ? '1px solid var(--accent)' : '1px solid var(--card-border)',
            background: marketplace === 'ozon' ? 'rgba(108, 92, 231, 0.12)' : 'rgba(255,255,255,0.02)',
            color: marketplace === 'ozon' ? 'var(--accent)' : 'var(--text-secondary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            textAlign: 'center'
          }}
        >
          🔵 Ozon
        </button>
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
                <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                  Подключаемся к {marketplace === 'yandex' ? 'Яндекс Маркету' : 'Ozon'}...
                </div>
              </div>
            )}
            <iframe
              src={`/api/market/webview?marketplace=${marketplace}&query=${encodeURIComponent(urlQuery)}`}
              title="Marketplace Webview"
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
                Введите название товара или категорию выше, и мы откроем маркетплейс прямо внутри приложения через безопасное соединение.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

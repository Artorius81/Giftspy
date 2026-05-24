import { useState, useEffect } from 'react'
import api from '../api'

export default function GiftSearchModal({ isOpen, onClose, initialQuery }) {
  const [query, setQuery] = useState(initialQuery || '')
  const [marketplace, setMarketplace] = useState('yandex') // 'yandex' or 'ozon'
  const [iframeQuery, setIframeQuery] = useState('')
  const [iframeLoading, setIframeLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      if (initialQuery) {
        setQuery(initialQuery)
        setIframeQuery(initialQuery)
        setIframeLoading(true)
      } else {
        setQuery('')
        setIframeQuery('')
        setIframeLoading(false)
      }
    }
  }, [isOpen, initialQuery])

  // Trigger load state when marketplace changes
  useEffect(() => {
    if (iframeQuery) {
      setIframeLoading(true)
    }
  }, [marketplace])

  const handleSearch = () => {
    if (query.trim()) {
      setIframeQuery(query.trim())
      setIframeLoading(true)
    }
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose} style={{ display: 'flex', zIndex: 1000 }}>
      <div className="modal-content gift-search-modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '14px 18px', borderBottom: '1px solid var(--card-border)', flexShrink: 0 }}>
          <span className="modal-title" style={{ fontSize: '16px', fontWeight: '800' }}>🛍️ Подбор подарка</span>
          <button className="modal-close" onClick={onClose} style={{ fontSize: '24px' }}>×</button>
        </div>

        {/* Search Bar */}
        <div className="search-bar-container" style={{ display: 'flex', gap: '8px', padding: '10px 16px', borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.01)', flexShrink: 0 }}>
          <input
            type="text"
            className="input search-input"
            style={{
              flex: 1,
              padding: '10px 12px',
              fontSize: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid var(--card-border)',
              color: 'var(--text)'
            }}
            placeholder="Поиск подарка..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button 
            className="btn btn--primary" 
            style={{
              width: '42px',
              height: '42px',
              padding: '0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)'
            }}
            onClick={handleSearch}
          >
            🔎
          </button>
        </div>

        {/* Marketplace Selector Tabs */}
        <div style={{ display: 'flex', gap: '8px', padding: '0 16px 10px 16px', background: 'var(--bg-secondary)', flexShrink: 0, borderBottom: '1px solid var(--card-border)' }}>
          <button
            onClick={() => setMarketplace('yandex')}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: '750',
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
              padding: '6px 10px',
              fontSize: '12px',
              fontWeight: '750',
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

        {/* Iframe View */}
        <div style={{ flex: 1, position: 'relative', width: '100%', overflow: 'hidden', minHeight: '400px', display: 'flex', flexDirection: 'column' }}>
          {iframeQuery ? (
            <div style={{ position: 'relative', width: '100%', flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                  background: '#0a0a0c',
                  zIndex: 10
                }}>
                  <div className="spinner" style={{ width: '32px', height: '32px', borderWidth: '2px', marginBottom: '12px' }} />
                  <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    Подключаемся к {marketplace === 'yandex' ? 'Яндекс Маркету' : 'Ozon'}...
                  </div>
                </div>
              )}
              <iframe
                src={`/api/market/webview?marketplace=${marketplace}&query=${encodeURIComponent(iframeQuery)}`}
                title="Marketplace Webview Modal"
                style={{
                  width: '100%',
                  flex: 1,
                  border: 'none',
                  background: 'var(--bg)'
                }}
                onLoad={() => setIframeLoading(false)}
              />
            </div>
          ) : (
            <div style={{ padding: '60px 20px', textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}>🛍️</div>
              <div className="empty-state__title" style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>
                Подберите идеальный подарок
              </div>
              <div className="empty-state__desc" style={{ maxWidth: '240px', margin: '6px auto 0', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.4' }}>
                Введите поисковый запрос выше, чтобы открыть маркетплейс прямо в этом окне.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

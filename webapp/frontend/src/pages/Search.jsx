import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const urlQuery = searchParams.get('query') || ''
  const [query, setQuery] = useState(urlQuery)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState('')
  const [selectedProduct, setSelectedProduct] = useState(null)
  
  const searchInputRef = useRef(null)

  // Trigger search when query param in URL changes
  useEffect(() => {
    if (urlQuery.trim()) {
      setQuery(urlQuery)
      performSearch(urlQuery, 0, true)
    } else {
      setResults([])
      setPage(0)
      setError('')
    }
  }, [urlQuery])

  // Sync Telegram Web App BackButton
  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (webApp) {
      webApp.BackButton.show()
      const handleBack = () => {
        if (selectedProduct) {
          setSelectedProduct(null)
        } else {
          navigate(-1)
        }
      }
      webApp.BackButton.onClick(handleBack)
      return () => {
        webApp.BackButton.offClick(handleBack)
      }
    }
  }, [selectedProduct, navigate])

  const performSearch = async (searchQuery, pageNum = 0, isInitial = true) => {
    if (!searchQuery || searchQuery.trim().length < 2) return

    if (isInitial) {
      setLoading(true)
      setError('')
      setResults([])
      setPage(0)
      setHasMore(true)
      setSelectedProduct(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const data = await api.searchMarket(searchQuery, pageNum)
      
      if (isInitial) {
        setResults(data)
        if (data.length === 0) {
          setError('Товары не найдены. Попробуйте изменить запрос.')
          setHasMore(false)
        } else if (data.length < 8) {
          // If Yandex returned fewer than 8 results, we probably hit the end
          setHasMore(false)
        }
      } else {
        if (data.length === 0) {
          setHasMore(false)
        } else {
          setResults(prev => [...prev, ...data])
          if (data.length < 8) {
            setHasMore(false)
          }
        }
      }
    } catch (err) {
      console.error(err)
      if (isInitial) {
        setError('Не удалось загрузить товары. Проверьте соединение.')
      } else {
        setError('Не удалось загрузить дополнительные товары.')
      }
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const handleSearchSubmit = (e) => {
    e?.preventDefault()
    if (query.trim()) {
      setSearchParams({ query: query.trim() })
    }
  }

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    performSearch(urlQuery, nextPage, false)
  }

  return (
    <div className="page search-page animate-fade-in" style={{ paddingBottom: '30px' }}>
      {/* Header with search bar */}
      <div className="header" style={{ padding: '8px 12px', height: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
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
      <div style={{ padding: '0 16px', marginTop: '16px' }}>
        {/* Empty state / Prompt to search */}
        {!urlQuery && (
          <div className="empty-state" style={{ padding: '60px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛍️</div>
            <div className="empty-state__title" style={{ fontSize: '18px', fontWeight: '700' }}>Найдите идеальный подарок</div>
            <div className="empty-state__desc" style={{ maxWidth: '280px', margin: '8px auto 0' }}>
              Введите название товара или категорию, и мы подберем лучшие варианты на Яндекс Маркете.
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div 
            className="search-error-message" 
            style={{
              textAlign: 'center', 
              color: 'var(--text-secondary)', 
              padding: '40px 20px',
              background: 'rgba(255, 71, 87, 0.03)',
              border: '1px solid rgba(255, 71, 87, 0.1)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              margin: '20px 0'
            }}
          >
            {error}
          </div>
        )}

        {/* Initial search skeletons */}
        {loading && (
          <div className="cards-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="ozon-card skeleton-card" style={{ height: '240px' }}>
                <div className="skeleton skeleton-image" style={{ height: '140px', width: '100%' }} />
                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton" style={{ height: '16px', width: '60%', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ height: '14px', width: '90%', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ height: '30px', width: '100%', marginTop: '8px', borderRadius: '4px' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search Results Grid */}
        {!loading && results.length > 0 && (
          <>
            <div className="cards-grid animate-fade-in">
              {results.map((product, idx) => (
                <div 
                  key={idx} 
                  className="ozon-card"
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="ozon-card-image-wrapper">
                    <img 
                      src={product.image} 
                      alt={product.title} 
                      className="ozon-card-image"
                      loading="lazy" 
                    />
                  </div>
                  <div className="ozon-card-content">
                    <div className="ozon-card-price-row">
                      <span className="ozon-card-price">
                        {product.price ? `${product.price.toLocaleString('ru-RU')} ₽` : 'Уточнить'}
                      </span>
                      {product.price && product.old_price && (
                        <span className="ozon-card-old-price">
                          {product.old_price.toLocaleString('ru-RU')} ₽
                        </span>
                      )}
                    </div>
                    <div className="ozon-card-title" title={product.title}>
                      {product.title}
                    </div>
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn--primary btn--small ozon-card-btn"
                      style={{ fontSize: '11px', padding: '6px 10px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Купить
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination / Load more button */}
            {hasMore && (
              <div style={{ textAlign: 'center', marginTop: '24px', marginBottom: '16px' }}>
                <button
                  className="btn btn--secondary"
                  disabled={loadingMore}
                  onClick={handleLoadMore}
                  style={{
                    width: 'auto',
                    minWidth: '160px',
                    padding: '12px 24px',
                    fontSize: '14px',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--card-border)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {loadingMore ? (
                    <>
                      <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                      <span>Загрузка...</span>
                    </>
                  ) : (
                    <span>Загрузить ещё 🔄</span>
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Product detailed modal view */}
      {selectedProduct && (
        <div className="modal-overlay" onClick={() => setSelectedProduct(null)} style={{ display: 'flex', zIndex: 1000 }}>
          <div className="modal-content gift-search-modal animate-slide-up" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <span className="modal-title">🛍️ Детали товара</span>
              <button className="modal-close" onClick={() => setSelectedProduct(null)}>×</button>
            </div>
            
            <div className="product-detail-view" style={{ padding: '8px 0' }}>
              <div className="product-detail-hero" style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '20px' }}>
                <div 
                  className="product-detail-image-container" 
                  style={{ 
                    width: '100%', 
                    aspectRatio: '1', 
                    borderRadius: 'var(--radius-md)', 
                    overflow: 'hidden', 
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--card-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <img 
                    src={selectedProduct.image} 
                    alt={selectedProduct.title} 
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                  />
                </div>
                
                <div className="product-detail-info">
                  <h2 className="product-detail-title" style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text)', lineHeight: '1.4', marginBottom: '10px' }}>
                    {selectedProduct.title}
                  </h2>
                  <div className="product-detail-price-row" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' }}>
                    <span className="product-price" style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent)' }}>
                      {selectedProduct.price ? `${selectedProduct.price.toLocaleString('ru-RU')} ₽` : 'Уточнить цену'}
                    </span>
                    {selectedProduct.price && selectedProduct.old_price && (
                      <span className="product-old-price" style={{ fontSize: '14px', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                        {selectedProduct.old_price.toLocaleString('ru-RU')} ₽
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="product-detail-section" style={{ borderTop: '1px solid var(--card-border)', paddingTop: '16px', marginBottom: '24px' }}>
                <div className="section-title" style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  🔍 Описание товара
                </div>
                <div className="product-detail-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', wordBreak: 'break-word' }}>
                  {selectedProduct.description || 'Описание отсутствует.'}
                </div>
              </div>

              <div className="product-detail-action">
                <a 
                  href={selectedProduct.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn btn--primary"
                  style={{ width: '100%', padding: '14px', display: 'block', textAlign: 'center', fontSize: '15px', fontWeight: '700' }}
                >
                  🛒 Купить на Яндекс Маркете
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

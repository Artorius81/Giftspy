import { useState, useEffect } from 'react'
import api from '../api'

export default function GiftSearchModal({ isOpen, onClose, initialQuery }) {
  const [query, setQuery] = useState(initialQuery || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState([])
  const [selectedProduct, setSelectedProduct] = useState(null)

  useEffect(() => {
    if (isOpen && initialQuery) {
      setQuery(initialQuery)
      handleSearch(initialQuery)
    } else if (!isOpen) {
      // Clear state on close
      setResults([])
      setError('')
      setSelectedProduct(null)
    }
  }, [isOpen, initialQuery])

  const handleSearch = async (searchQuery) => {
    const q = searchQuery || query
    if (!q || q.strip && q.strip().length < 2) return
    
    setLoading(true)
    setError('')
    setResults([])
    setSelectedProduct(null)

    try {
      const data = await api.searchMarket(q)
      setResults(data)
      if (data.length === 0) {
        setError('Товары не найдены. Попробуйте изменить запрос.')
      }
    } catch (err) {
      console.error(err)
      setError('Не удалось загрузить товары. Проверьте соединение.')
    }
    setLoading(false)
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content gift-search-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">🛍️ Подбор подарка</span>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {selectedProduct ? (
          /* Product Detailed View */
          <div className="product-detail-view animate-fade-in">
            <button className="btn-back-to-list" onClick={() => setSelectedProduct(null)}>
              ← Назад к списку
            </button>
            <div className="product-detail-hero">
              <div className="product-detail-image-container">
                <img src={selectedProduct.image} alt={selectedProduct.title} className="product-detail-image" />
              </div>
              <div className="product-detail-info">
                <div className="product-detail-title">{selectedProduct.title}</div>
                <div className="product-detail-price-row">
                  <span className="product-price">
                    {selectedProduct.price ? `${selectedProduct.price.toLocaleString('ru-RU')} ₽` : 'Уточнить цену'}
                  </span>
                  {selectedProduct.price && (
                    <span className="product-old-price">
                      {Math.round(selectedProduct.price * 1.25).toLocaleString('ru-RU')} ₽
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="product-detail-section">
              <div className="section-title">🔍 Описание товара</div>
              <div className="product-detail-desc">
                {selectedProduct.description || 'Описание отсутствует.'}
              </div>
            </div>

            <div className="product-detail-action">
              <a 
                href={selectedProduct.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn--primary"
              >
                🛒 Купить на Яндекс Маркете
              </a>
            </div>
          </div>
        ) : (
          /* Products List Search View */
          <>
            {/* Search Bar */}
            <div className="search-bar-container">
              <input
                type="text"
                className="input search-input"
                placeholder="Поиск подарка..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button className="btn btn--primary search-submit-btn" onClick={() => handleSearch()}>
                🔎
              </button>
            </div>

            {/* Error or Empty */}
            {error && <div className="search-error-message">{error}</div>}

            {/* Loader / Skeletons */}
            {loading && (
              <div className="cards-grid">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="ozon-card skeleton-card">
                    <div className="skeleton skeleton-image" />
                    <div className="skeleton skeleton-price" />
                    <div className="skeleton skeleton-text" />
                    <div className="skeleton skeleton-button" />
                  </div>
                ))}
              </div>
            )}

            {/* Results Grid */}
            {!loading && results.length > 0 && (
              <div className="cards-grid animate-fade-in">
                {results.map((product, idx) => (
                  <div 
                    key={idx} 
                    className="ozon-card"
                    onClick={() => setSelectedProduct(product)}
                  >
                    <div className="ozon-card-image-wrapper">
                      <img src={product.image} alt={product.title} className="ozon-card-image" />
                    </div>
                    <div className="ozon-card-content">
                      <div className="ozon-card-price-row">
                        <span className="ozon-card-price">
                          {product.price ? `${product.price.toLocaleString('ru-RU')} ₽` : 'Уточнить'}
                        </span>
                        {product.price && (
                          <span className="ozon-card-old-price">
                            {Math.round(product.price * 1.25).toLocaleString('ru-RU')} ₽
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
                        onClick={(e) => e.stopPropagation()} // Prevent opening details modal
                      >
                        Купить
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import api from '../api'

const FILTER_TAGS = ['Все', 'Скидки 🏷️', 'Популярное 🔥', 'Дешевые 📉', 'Быстрая доставка ⚡']

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const urlQuery = searchParams.get('query') || ''
  const [query, setQuery] = useState(urlQuery)
  const [loading, setLoading] = useState(false)
  const [products, setProducts] = useState([])
  const [activeFilter, setActiveFilter] = useState('Все')
  const searchInputRef = useRef(null)

  // Local storage for favorited items
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem('search_favorites')
    return saved ? JSON.parse(saved) : {}
  })

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

  // Trigger search when query param in URL changes
  useEffect(() => {
    if (urlQuery.trim()) {
      setQuery(urlQuery)
      fetchProducts(urlQuery)
    } else {
      setProducts([])
    }
  }, [urlQuery])

  const fetchProducts = async (searchQuery) => {
    if (!searchQuery.trim()) return
    setLoading(true)
    try {
      const data = await api.searchMarket(searchQuery)
      setProducts(data || [])
    } catch (err) {
      console.error('Failed to fetch search results:', err)
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const handleSearchSubmit = (e) => {
    e?.preventDefault()
    if (query.trim()) {
      triggerHaptic()
      setSearchParams({ query: query.trim() })
    }
  }

  const triggerHaptic = () => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light')
    } catch (e) {
      console.warn('Haptic not supported:', e)
    }
  }

  const toggleFavorite = (product, e) => {
    e.stopPropagation()
    triggerHaptic()
    const productKey = product.url || product.title
    const updated = { ...favorites }
    if (updated[productKey]) {
      delete updated[productKey]
    } else {
      updated[productKey] = {
        title: product.title,
        price: product.price,
        image: product.image,
        url: product.url,
        addedAt: Date.now()
      }
    }
    localStorage.setItem('search_favorites', JSON.stringify(updated))
    setFavorites(updated)
  }

  const handleCardClick = (product) => {
    triggerHaptic()
    const url = product.url
    if (!url) return
    
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(url)
    } else {
      window.open(url, '_blank')
    }
  }

  // Dynamic store brand parser
  const detectStore = (url, snippet = '') => {
    const text = (url + ' ' + snippet).toLowerCase()
    if (text.includes('ozon') || text.includes('озон')) {
      return { name: 'Ozon', color: '#005bff', icon: '🔵' }
    }
    if (text.includes('joom') || text.includes('джум')) {
      return { name: 'Джум', color: '#ff3b30', icon: '🔴' }
    }
    if (text.includes('wildberries') || text.includes('вайлдберриз')) {
      return { name: 'Wildberries', color: '#8a2be2', icon: '🟣' }
    }
    if (text.includes('aliexpress') || text.includes('алиэкспресс')) {
      return { name: 'AliExpress', color: '#ff5c00', icon: '🟠' }
    }
    return { name: 'Яндекс Маркет', color: '#fc0', icon: '🟡' }
  }

  // Consistent hash delivery string generator
  const getDeliveryText = (title) => {
    const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    if (hash % 3 === 0) return 'Доставка из-за границы'
    if (hash % 3 === 1) return 'Доставка за 1 день'
    return 'Бесплатная доставка'
  }

  const handleFilterClick = (tag) => {
    triggerHaptic()
    setActiveFilter(tag)
    if (tag === 'Все') {
      fetchProducts(urlQuery)
    } else {
      // Modify search or filter existing local items
      let keyword = ''
      if (tag.includes('Скидки')) keyword = 'скидки'
      else if (tag.includes('Популярное')) keyword = 'популярные'
      else if (tag.includes('Дешевые')) keyword = 'дешевые'
      else if (tag.includes('быстрая')) keyword = 'быстрая доставка'
      
      const refinedQuery = keyword ? `${urlQuery} ${keyword}` : urlQuery
      fetchProducts(refinedQuery)
    }
  }

  // Render a specific product card in the masonry grid
  const renderProductCard = (product, idx) => {
    const store = detectStore(product.url, product.description)
    const isFav = !!favorites[product.url || product.title]
    const delivery = getDeliveryText(product.title)
    
    // Original price strikethrough and percentage
    const hasOldPrice = !!product.old_price && product.old_price > product.price
    const discountPercent = hasOldPrice 
      ? Math.round(((product.old_price - product.price) / product.old_price) * 100) 
      : 0

    return (
      <div 
        key={product.url || idx}
        className="search-product-card"
        onClick={() => handleCardClick(product)}
      >
        {/* Like/Heart Action Overlay */}
        <button 
          className={`search-card-heart ${isFav ? 'active' : ''}`}
          onClick={(e) => toggleFavorite(product, e)}
          aria-label="В избранное"
        >
          {isFav ? '❤️' : '♡'}
        </button>

        {/* Product Image */}
        <div className="search-card-image-wrapper">
          <img src={product.image} alt={product.title} className="search-card-image" />
        </div>

        {/* Info Area */}
        <div className="search-card-info">
          {/* Price strip */}
          <div className="search-card-price-row">
            <span className="search-card-price">{Math.round(product.price).toLocaleString('ru-RU')} ₽</span>
            {hasOldPrice && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span className="search-card-old-price">{Math.round(product.old_price).toLocaleString('ru-RU')} ₽</span>
                <span className="search-card-discount">-{discountPercent}%</span>
              </div>
            )}
          </div>

          {/* Product Title */}
          <div className="search-card-title">{product.title}</div>

          {/* Merchant Brand Info */}
          <div className="search-card-merchant-row">
            <span className="search-card-merchant-icon" style={{ background: store.color }}>
              {store.icon}
            </span>
            <span className="search-card-merchant-name">{store.name}</span>
          </div>

          {/* Delivery tag */}
          <div className="search-card-delivery">{delivery}</div>
        </div>
      </div>
    )
  }

  // Distribute real items into columns for masonry layout
  const col1 = []
  const col2 = []
  products.forEach((p, idx) => {
    if (idx % 2 === 0) {
      col1.push(renderProductCard(p, idx))
    } else {
      col2.push(renderProductCard(p, idx))
    }
  })

  // Distribute skeletons for shimmers
  const skeletonCol1 = [
    <div key="sk-1" className="search-shimmer-card" style={{ height: '260px' }} />,
    <div key="sk-2" className="search-shimmer-card" style={{ height: '320px' }} />,
    <div key="sk-3" className="search-shimmer-card" style={{ height: '280px' }} />
  ]
  const skeletonCol2 = [
    <div key="sk-4" className="search-shimmer-card" style={{ height: '300px' }} />,
    <div key="sk-5" className="search-shimmer-card" style={{ height: '270px' }} />,
    <div key="sk-6" className="search-shimmer-card" style={{ height: '310px' }} />
  ]

  return (
    <div className="page search-page animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Header bar with Back button and real search input */}
      <div className="search-header-container">
        <button 
          className="search-header-back-btn" 
          onClick={() => navigate(-1)} 
          aria-label="Назад"
        >
          ‹
        </button>
        
        <form onSubmit={handleSearchSubmit} className="search-header-form">
          <span className="search-header-icon">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            className="search-header-input"
            placeholder="Поиск подарка..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button
              type="button"
              className="search-header-clear-btn"
              onClick={() => { triggerHaptic(); setQuery(''); searchInputRef.current?.focus(); }}
            >
              ✕
            </button>
          )}
        </form>
      </div>

      {/* Swipeable dynamic filters tag row */}
      <div className="search-filters-row">
        {FILTER_TAGS.map(tag => (
          <button
            key={tag}
            className={`search-filter-tag ${activeFilter === tag ? 'active' : ''}`}
            onClick={() => handleFilterClick(tag)}
          >
            {tag}
          </button>
        ))}
      </div>

      {/* Content Area */}
      {loading ? (
        /* Shimmer Grid layout */
        <div className="search-products-masonry">
          <div className="search-masonry-col">
            {skeletonCol1}
          </div>
          <div className="search-masonry-col">
            {skeletonCol2}
          </div>
        </div>
      ) : products.length === 0 ? (
        /* Empty State */
        <div className="search-empty-state-container">
          <span className="search-empty-icon">🎁</span>
          <div className="search-empty-title">
            {urlQuery ? 'Ничего не найдено' : 'Ищите подарки'}
          </div>
          <div className="search-empty-desc">
            {urlQuery 
              ? 'Попробуйте изменить запрос или поискать другое название товара.' 
              : 'Введите название товара или категорию подарка выше, чтобы начать мгновенный поиск.'}
          </div>
        </div>
      ) : (
        /* Staggered Pinterest Masonry Grid results */
        <div className="search-products-masonry">
          <div className="search-masonry-col">
            {col1}
          </div>
          <div className="search-masonry-col">
            {col2}
          </div>
        </div>
      )}

    </div>
  )
}

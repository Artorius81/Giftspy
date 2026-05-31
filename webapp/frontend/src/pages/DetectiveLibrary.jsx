import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { showAlert } from '../utils/popup'
import detectiveImg from '../assets/detective.png'

export default function DetectiveLibrary() {
  const navigate = useNavigate()
  const [personas, setPersonas] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const triggerHaptic = (style = 'light') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style)
    } catch { }
  }

  // Load public personas
  useEffect(() => {
    const fetchPublicPersonas = async () => {
      setLoading(true)
      try {
        const result = await api.getPublicPersonas()
        setPersonas(result || [])
      } catch (err) {
        showAlert(err.message)
      }
      setLoading(false)
    }

    fetchPublicPersonas()
  }, [])

  // Configure Telegram Back Button
  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return

    const handleBack = () => {
      navigate(-1)
    }

    webApp.BackButton.show()
    webApp.BackButton.onClick(handleBack)

    return () => {
      webApp.BackButton.offClick(handleBack)
    }
  }, [navigate])

  const handleToggleAdd = async (p) => {
    triggerHaptic('medium')
    try {
      if (p.is_added) {
        await api.removePersonaFromLibrary(p.id)
        setPersonas(prev => prev.map(item => item.id === p.id ? { ...item, is_added: false } : item))
        try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch { }
        await showAlert(`🗑️ Детектив ${p.name} удален из вашей карусели`)
      } else {
        await api.addPersonaToLibrary(p.id)
        setPersonas(prev => prev.map(item => item.id === p.id ? { ...item, is_added: true } : item))
        try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch { }
        await showAlert(`✨ Детектив ${p.name} успешно добавлен в вашу карусель!`)
      }
    } catch (err) {
      await showAlert(err.message)
    }
  }

  // Filtered public personas
  const filteredPersonas = personas.filter(p => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      (p.name && p.name.toLowerCase().includes(q)) ||
      (p.specialty && p.specialty.toLowerCase().includes(q)) ||
      (p.desc && p.desc.toLowerCase().includes(q))
    )
  })

  return (
    <div className="page page-profile-bg" style={{ padding: 0 }}>
      <div className="settings-new-container" style={{ paddingBottom: '90px' }}>
      
      {/* Page Header */}
      <div className="settings-new-header" style={{ marginBottom: '16px', background: 'transparent' }}>
        <button 
          className="wishlist-header-btn" 
          onClick={() => navigate(-1)} 
          style={{ width: 36, height: 36 }}
          aria-label="Назад"
        >
          ‹
        </button>
        <h1 className="settings-new-title">🌍 Библиотека сообщества</h1>
        <div style={{ width: 36 }} />
      </div>

      <p style={{ 
        fontSize: '13px', 
        color: 'var(--text-secondary)', 
        textAlign: 'center', 
        lineHeight: '1.4',
        margin: '-8px 8px 16px 8px'
      }}>
        Здесь вы найдете уникальных сыщиков, созданных другими игроками Giftspy, которых можно добавить прямо к себе в карусель!
      </p>

      {/* Styled Search Bar with Clear Cross */}
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        margin: '0 8px 20px 8px',
        boxSizing: 'border-box'
      }}>
        <span style={{
          position: 'absolute',
          left: '12px',
          color: 'var(--text-secondary)',
          fontSize: '16px'
        }}>🔍</span>
        
        <input
          className="input"
          placeholder="Поиск детективов по имени или умению..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            paddingLeft: '38px',
            paddingRight: searchQuery ? '38px' : '16px',
            fontSize: '13.5px',
            width: '100%',
            height: '44px',
            borderRadius: '22px',
            border: '1px solid var(--card-border)',
            background: 'rgba(255, 255, 255, 0.03)',
            boxSizing: 'border-box'
          }}
        />

        {searchQuery && (
          <button
            type="button"
            onClick={() => { triggerHaptic(); setSearchQuery(''); }}
            style={{
              position: 'absolute',
              right: '12px',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '15px',
              cursor: 'pointer',
              padding: '6px'
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Library List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 8px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div className="spinner" />
          </div>
        ) : filteredPersonas.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '60px 10px', 
            color: 'var(--text-secondary)', 
            fontSize: '14px',
            background: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '20px'
          }}>
            {searchQuery 
              ? '🔍 Ничего не найдено по вашему запросу.' 
              : '👥 В библиотеке пока пусто. Создайте своего уникального детектива первым!'}
          </div>
        ) : (
          filteredPersonas.map(p => (
            <div 
              key={p.id} 
              className="card no-active-scale" 
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                padding: '16px 18px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Premium Glow Highlight */}
              <div style={{
                position: 'absolute',
                top: '-50px',
                right: '-50px',
                width: '100px',
                height: '100px',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(167, 139, 250, 0.08) 0%, transparent 70%)',
                pointerEvents: 'none'
              }} />

              {/* Main Info Row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{
                  width: '54px',
                  height: '80px',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '1px solid var(--card-border)'
                }}>
                  <img 
                    src={p.photo || detectiveImg} 
                    alt={p.name} 
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      objectFit: p.photo ? 'cover' : 'contain', 
                      padding: p.photo ? '0' : '10px',
                      boxSizing: 'border-box'
                    }} 
                  />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontWeight: '800', 
                    fontSize: '16px', 
                    color: 'var(--text)', 
                    lineHeight: '1.2',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ fontSize: '12px' }}>{p.emojis?.split(',')[0] || '🕵️‍♂️'}</span>
                  </div>
                  
                  <div style={{ 
                    fontSize: '11px', 
                    color: 'var(--accent)', 
                    fontWeight: '800', 
                    textTransform: 'uppercase',
                    letterSpacing: '0.4px',
                    marginTop: '4px' 
                  }}>
                    {p.specialty || 'Секретное расследование 🕵️‍♂️'}
                  </div>

                  <div style={{ 
                    fontSize: '12.5px', 
                    color: 'var(--text-secondary)', 
                    marginTop: '8px', 
                    lineHeight: '1.4'
                  }}>
                    {p.desc}
                  </div>
                </div>
              </div>

              {/* Custom Skills block with horizontal bars */}
              {p.skills && p.skills.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px', 
                  padding: '12px', 
                  background: 'rgba(255,255,255,0.015)',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.03)'
                }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Характеристики характера
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {p.skills.slice(0, 3).map((sk, sIdx) => (
                      <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', width: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 'bold' }}>
                          {sk.label}
                        </span>
                        
                        {/* Progress Bar Track */}
                        <div style={{ 
                          flex: 1, 
                          height: '5px', 
                          background: 'rgba(255,255,255,0.04)', 
                          borderRadius: '3px',
                          overflow: 'hidden'
                        }}>
                          <div style={{ 
                            width: `${sk.val}%`, 
                            height: '100%', 
                            background: sk.color || 'var(--accent)',
                            boxShadow: `0 0 6px ${sk.color || 'var(--accent)'}`,
                            borderRadius: '3px'
                          }} />
                        </div>

                        <span style={{ fontSize: '10px', fontWeight: 'bold', width: '28px', textAlign: 'right', color: sk.color || 'var(--accent)' }}>
                          {sk.val}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add / Remove to active carousel button */}
              <button
                onClick={() => handleToggleAdd(p)}
                className={`btn ${p.is_added ? 'btn--secondary' : 'btn--primary'}`}
                style={{
                  padding: '12px',
                  borderRadius: '16px',
                  fontSize: '13.5px',
                  fontWeight: 'bold',
                  marginTop: '4px',
                  background: p.is_added ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg, #a78bfa 0%, #6c5ce7 100%)',
                  border: p.is_added ? '1px solid var(--card-border)' : 'none',
                  boxShadow: p.is_added ? 'none' : 'var(--shadow-glow-subtle)'
                }}
              >
                {p.is_added ? '🗑️ Убрать из карусели' : '＋ Добавить к себе в карусель'}
              </button>
            </div>
          ))
        )}
      </div>
      </div>
    </div>
  )
}

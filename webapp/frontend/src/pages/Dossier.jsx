import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'

const STATUS = {
  pending: { icon: '🟡', label: 'Ожидание', dot: 'pending' },
  started: { icon: '🔵', label: 'Начато', dot: 'active' },
  in_progress: { icon: '🔵', label: 'Допрос', dot: 'active' },
  manual_mode: { icon: '🛑', label: 'Перехват', dot: 'active' },
  done: { icon: '✅', label: 'Готово', dot: 'done' },
  delivered: { icon: '✅', label: 'Доставлено', dot: 'done' },
  cancelled: { icon: '❌', label: 'Отменено', dot: 'cancelled' },
  error: { icon: '⚠️', label: 'Ошибка', dot: 'cancelled' },
}

export default function Dossier() {
  const navigate = useNavigate()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState({})

  const loadCases = () => {
    api.getCases()
      .then(setCases)
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCases()
    // Poll every 10 seconds for status updates
    const interval = setInterval(() => {
      api.getCases().then(setCases).catch(console.error)
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const toggleGroup = (target) => {
    setCollapsed(prev => ({ ...prev, [target]: !prev[target] }))
  }

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>

  // Group by target
  const grouped = {}
  cases.forEach(c => {
    if (!grouped[c.target]) grouped[c.target] = { display: c.display_name, cases: [] }
    grouped[c.target].cases.push(c)
  })

  return (
    <div className="page">
      <div className="header">
        <h1 className="header__title">📁 Картотека</h1>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {cases.length} дел
        </span>
      </div>

      {cases.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🗄</div>
          <div className="empty-state__title">Картотека пуста</div>
          <div className="empty-state__desc">Начните расследование, чтобы дело появилось здесь</div>
          <button className="btn btn--primary" style={{ maxWidth: 240, margin: '0 auto' }} onClick={() => navigate('/new-case')}>
            🔍 Новое дело
          </button>
        </div>
      ) : (
        Object.entries(grouped).map(([target, group]) => {
          const isCollapsed = collapsed[target]
          return (
            <div key={target}>
              <div
                className="section-header section-header--clickable"
                onClick={() => toggleGroup(target)}
              >
                <div className="section-header__title">
                  <span className={`collapse-arrow ${isCollapsed ? 'collapsed' : ''}`}>▾</span>
                  {' '}👤 {group.display}
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{group.cases.length} дел</span>
              </div>
              {!isCollapsed && group.cases.map(c => {
                const st = STATUS[c.status] || STATUS.error
                return (
                  <div key={c.id} className="card" onClick={() => navigate(`/dossier/${c.id}`)}>
                    <div className="card__header">
                      <div className="card__avatar">{(c.status === 'done' || c.status === 'delivered') ? '🎁' : st.icon}</div>
                      <div className="card__info">
                        <div className="card__name">Дело №{c.id}</div>
                        <div className="card__sub">
                          <span className={`status-dot status-dot--${st.dot}`} />
                          {st.label}
                        </div>
                      </div>
                      {c.has_report && <span className="badge badge--success">📋 Отчёт</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      )}
    </div>
  )
}

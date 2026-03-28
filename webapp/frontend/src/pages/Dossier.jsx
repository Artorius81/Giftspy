import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { getTargetEmoji } from './TargetDetail'

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
    if (!grouped[c.target]) {
      grouped[c.target] = { 
        display: c.display_name, 
        cases: [],
        target_photo: c.target_photo,
        target_db_id: c.target_db_id
      }
    }
    grouped[c.target].cases.push(c)
  })

  return (
    <div className="page">
      <div className="header">
        <div className="header__placeholder" />
        <h1 className="header__title">📁 Досье</h1>
        <div className="header__placeholder" />
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
        {cases.length} дел
      </span>

      {cases.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state__icon">🗄</div>
          <div className="empty-state__title">Досье пусто</div>
          <div className="empty-state__desc">Начните расследование, чтобы дело появилось здесь</div>
          <button className="btn btn--primary" style={{ maxWidth: 240, margin: '0 auto' }} onClick={() => navigate('/new-case')}>
            🔍 Новое дело
          </button>
        </div>
      ) : (
        Object.entries(grouped).map(([target, group]) => {
          // Default to collapsed unless explicitly uncollapsed
          const isExpanded = collapsed[target] === true
          return (
            <div key={target} style={{ marginBottom: 16 }}>
              {/* Target Card */}
              <div
                className="card"
                style={{ marginBottom: isExpanded ? 8 : 0, transition: 'var(--transition)' }}
                onClick={() => toggleGroup(target)}
              >
                <div className="card__header" style={{ marginBottom: 0 }}>
                  <div className="card__avatar">
                    {group.target_photo ? <img src={group.target_photo} alt="" /> : getTargetEmoji(group.target_db_id || 0)}
                  </div>
                  <div className="card__info">
                    <div className="card__name">{group.display}</div>
                    <div className="card__sub">{target}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{group.cases.length} дел</span>
                    <span className={`collapse-arrow ${!isExpanded ? 'collapsed' : ''}`} style={{ fontSize: 18 }}>▾</span>
                  </div>
                </div>
              </div>

              {/* Cases List */}
              <div className={`expandable-content ${isExpanded ? 'expanded' : ''}`}>
                <div className="expandable-inner" style={{ paddingLeft: 12, paddingTop: isExpanded ? 4 : 0 }}>
                  {group.cases.map(c => {
                    const st = STATUS[c.status] || STATUS.error
                    return (
                      <div key={c.id} className="card" style={{ padding: '12px 16px', marginBottom: 8, background: 'var(--bg-secondary)' }} onClick={() => navigate(`/dossier/${c.id}`)}>
                        <div className="card__header" style={{ marginBottom: 0 }}>
                          <div className="card__avatar" style={{ width: 36, height: 36, fontSize: 18 }}>
                            {(c.status === 'done' || c.status === 'delivered') ? '🎁' : st.icon}
                          </div>
                          <div className="card__info">
                            <div className="card__name" style={{ fontSize: 14 }}>Дело №{c.id}</div>
                            <div className="card__sub" style={{ fontSize: 12 }}>
                              <span className={`status-dot status-dot--${st.dot}`} />
                              {st.label}
                            </div>
                          </div>
                          {c.has_report && <span className="badge badge--success" style={{ padding: '2px 8px', fontSize: 10 }}>📋 Отчёт</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

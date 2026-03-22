import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'

const STATUS_MAP = {
  pending: '🟡 Ожидание',
  started: '🔵 Начато',
  in_progress: '🔵 Допрос идёт',
  manual_mode: '🛑 Перехват',
  done: '✅ Готово',
  delivered: '✅ Доставлено',
  cancelled: '❌ Отменено',
  error: '⚠️ Ошибка',
}

export default function CaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [caseData, setCaseData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getCase(id)
      .then(setCaseData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>
  if (!caseData) return <div className="page"><div className="empty-state"><div className="empty-state__title">Дело не найдено</div></div></div>

  const isActive = ['pending', 'started', 'in_progress', 'manual_mode'].includes(caseData.status)

  return (
    <div className="page">
      <div className="header">
        <button className="header__back" onClick={() => navigate('/dossier')}>← Картотека</button>
      </div>

      {/* Case Header Card */}
      <div className="card" style={{ background: 'var(--gradient-card)' }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
          📁 Дело №{caseData.id}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
          <div>🎯 <strong>Цель:</strong> {caseData.display_name}</div>
          <div>🎉 <strong>Повод:</strong> {caseData.holiday}</div>
          <div>🕵️ <strong>Детектив:</strong> {caseData.persona}</div>
          <div>💵 <strong>Бюджет:</strong> {caseData.budget}</div>
          <div style={{ marginTop: 4 }}>
            <span className={`badge ${isActive ? 'badge--active' : caseData.status === 'done' || caseData.status === 'delivered' ? 'badge--success' : 'badge--danger'}`}>
              {STATUS_MAP[caseData.status] || caseData.status}
            </span>
          </div>
        </div>
      </div>

      {/* Context */}
      {caseData.context && caseData.context !== 'Нет данных' && (
        <>
          <div className="section-header">
            <div className="section-header__title">🧩 Зацепки</div>
          </div>
          <div className="card">
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{caseData.context}</p>
          </div>
        </>
      )}

      {/* Report */}
      {caseData.report && (
        <>
          <div className="section-header">
            <div className="section-header__title">🎁 Отчёт детектива</div>
          </div>
          <div className="report-block">{caseData.report}</div>
        </>
      )}

      {/* Active case indicator */}
      {isActive && !caseData.report && (
        <div className="card" style={{ textAlign: 'center', marginTop: 16 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🕵️‍♂️</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Расследование в процессе</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Детектив работает над делом. Вы получите уведомление, когда отчёт будет готов.
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn btn--secondary" onClick={() => navigate(`/new-case?target=${caseData.target}`)}>
          🔄 Новое расследование
        </button>
      </div>
    </div>
  )
}

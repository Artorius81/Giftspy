import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import CaseChatView from '../components/CaseChatView'
import { useData, mutateData } from '../hooks/useData'

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
  const { data: caseData, loading, mutate } = useData(`case_${id}`, () => api.getCase(id))
  const { data: profile } = useData('profile', api.getProfile)
  const [viewMode, setViewMode] = useState('summary')
  const [cancelling, setCancelling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const pollRef = useRef(null)

  useEffect(() => {
    pollRef.current = setInterval(() => {
      api.getCase(id).then(mutate).catch(console.error)
    }, 5000)
    return () => clearInterval(pollRef.current)
  }, [id])

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>
  if (!caseData) return <div className="page"><div className="empty-state"><div className="empty-state__title">Дело не найдено</div></div></div>

  const isActive = ['pending', 'started', 'in_progress', 'manual_mode'].includes(caseData.status)
  const isClosed = ['done', 'delivered', 'cancelled', 'error'].includes(caseData.status)

  const handleStatusChange = (newStatus) => {
    if (caseData) {
      mutate({ ...caseData, status: newStatus })
    }
  }

  const handleCancel = async () => {
    if (!confirm('Отменить расследование? Детектив прекратит допрос.')) return
    setCancelling(true)
    try {
      const result = await api.cancelCase(id)
      mutate({ ...caseData, status: 'cancelled' })
      // Refresh profile to update balance
      api.getProfile().then(p => mutateData('profile', p)).catch(() => {})
      api.getCases().then(c => mutateData('cases', c)).catch(() => {})
      if (result.refunded) {
        alert('Расследование отменено. Монета возвращена на баланс.')
      }
    } catch (e) {
      alert(e.message)
    }
    setCancelling(false)
  }

  const handleDelete = async () => {
    if (!confirm('Удалить дело? Вся история переписки будет потеряна.')) return
    setDeleting(true)
    try {
      await api.deleteCase(id)
      // Refresh cases list
      api.getCases().then(c => mutateData('cases', c)).catch(() => {})
      navigate('/dossier')
    } catch (e) {
      alert(e.message)
    }
    setDeleting(false)
  }

  return (
    <div className="page case-detail-page">
      <div className="chat-header">
        <button className="chat-header__btn" onClick={() => viewMode === 'chat' ? setViewMode('summary') : navigate('/dossier')}>
          <span className="icon">‹</span>
        </button>
        <div className="chat-header__title">
          {caseData.display_name} · №{caseData.id}
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Tab content with slide animation */}
      <div className="case-tabs-container">
        <div className={`case-tab-panel ${viewMode === 'summary' ? 'case-tab-panel--active-left' : 'case-tab-panel--active-right'}`}>
          {/* Summary Panel */}
          <div className="case-tab-content">
            <div className="case-content">
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
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 60 }}>
                <button className="btn btn--secondary" onClick={() => navigate(`/new-case?target=${caseData.target}`)}>
                  🔄 Новое расследование
                </button>
                {isActive && (
                  <button className="btn btn--danger" onClick={handleCancel} disabled={cancelling}>
                    {cancelling ? '⏳ Отмена...' : '❌ Отменить расследование'}
                  </button>
                )}
                {isClosed && (
                  <button className="btn btn--danger" onClick={handleDelete} disabled={deleting}>
                    {deleting ? '⏳ Удаление...' : '🗑 Удалить дело'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Chat Panel */}
          <div className="case-tab-content">
            <CaseChatView
              caseId={caseData.id}
              spyMode={caseData.spy_mode}
              isPremium={!!profile?.is_premium}
              caseStatus={caseData.status}
              targetName={caseData.display_name}
              personaName={caseData.persona}
              targetPhoto={caseData.target_photo}
              targetDbId={caseData.target_db_id}
              onStatusChange={handleStatusChange}
            />
          </div>
        </div>
      </div>

      {/* Floating Toggle */}
      <div className="chat-view-toggle">
        <button className={`chat-view-toggle-btn ${viewMode === 'summary' ? 'active' : ''}`} onClick={() => setViewMode('summary')}>
          ≡ Сводка
        </button>
        <button className={`chat-view-toggle-btn ${viewMode === 'chat' ? 'active' : ''}`} onClick={() => setViewMode('chat')}>
          🗨 Переписка
        </button>
      </div>
    </div>
  )
}

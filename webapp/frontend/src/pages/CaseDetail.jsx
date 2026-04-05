import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import CaseChatView from '../components/CaseChatView'
import TabView from '../components/TabView'
import { useData, mutateData } from '../hooks/useData'
import { showAlert, showConfirm } from '../utils/popup'
import { timeAgo, formatDuration } from '../utils/timeAgo'

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
  const [tabIndex, setTabIndex] = useState(0)
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
    if (!await showConfirm('Отменить расследование? Детектив прекратит допрос.')) return
    setCancelling(true)
    try {
      const result = await api.cancelCase(id)
      mutate({ ...caseData, status: 'cancelled' })
      api.getProfile().then(p => mutateData('profile', p)).catch(() => {})
      api.getCases().then(c => mutateData('cases', c)).catch(() => {})
      if (result.refunded) {
        await showAlert('Расследование отменено. Монета возвращена на баланс.')
      }
    } catch (e) {
      await showAlert(e.message)
    }
    setCancelling(false)
  }

  const handleDelete = async () => {
    if (!await showConfirm('Удалить дело? Вся история переписки будет потеряна.')) return
    setDeleting(true)
    try {
      await api.deleteCase(id)
      api.getCases().then(c => mutateData('cases', c)).catch(() => {})
      navigate('/dossier', { replace: true })
    } catch (e) {
      await showAlert(e.message)
    }
    setDeleting(false)
  }

  return (
    <div className="page case-detail-page">
      <div className="chat-header">
        <button className="chat-header__btn" onClick={() => tabIndex === 1 ? setTabIndex(0) : navigate(-1)}>
          <span className="icon">‹</span>
        </button>
        <div className="chat-header__title">
          {caseData.display_name} · №{caseData.id}
        </div>
        <div style={{ width: 40 }} />
      </div>

      <TabView activeIndex={tabIndex} onChangeIndex={setTabIndex}>
        {/* Tab 0: Summary */}
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
              {caseData.created_at && (
                <div>📅 <strong>Начато:</strong> {timeAgo(caseData.created_at)}</div>
              )}
              {caseData.completed_at && (
                <div>✅ <strong>Завершено:</strong> {timeAgo(caseData.completed_at)}
                  {caseData.created_at && (
                    <span style={{ color: 'var(--text-secondary)', marginLeft: 6, fontSize: 12 }}>
                      (за {formatDuration(caseData.created_at, caseData.completed_at)})
                    </span>
                  )}
                </div>
              )}
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
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 100 }}>
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

        {/* Tab 1: Chat */}
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
      </TabView>

      {/* Floating Toggle */}
      <div className="chat-view-toggle">
        <button className={`chat-view-toggle-btn ${tabIndex === 0 ? 'active' : ''}`} onClick={() => setTabIndex(0)}>
          <span className="chat-view-toggle-btn__icon">≡</span> Сводка
        </button>
        <button className={`chat-view-toggle-btn ${tabIndex === 1 ? 'active' : ''}`} onClick={() => setTabIndex(1)}>
          <span className="chat-view-toggle-btn__icon">🔒</span> Переписка
        </button>
      </div>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import CaseChatView from '../components/CaseChatView'
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
  const [viewMode, setViewMode] = useState('summary')
  const [cancelling, setCancelling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const pollRef = useRef(null)

  // Swipe state
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const directionDecided = useRef(false)
  const isHorizontal = useRef(false)

  const handleSwipeStart = useCallback((e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
    directionDecided.current = false
    isHorizontal.current = false
    setIsSwiping(false)
    setSwipeOffset(0)
  }, [])

  const handleSwipeMove = useCallback((e) => {
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = e.touches[0].clientY - touchStartY.current

    // Decide direction on first significant movement
    if (!directionDecided.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        directionDecided.current = true
        isHorizontal.current = Math.abs(dx) > Math.abs(dy)
        if (isHorizontal.current) {
          setIsSwiping(true)
        }
      }
      return
    }

    if (!isHorizontal.current) return

    // Clamp: don't swipe past boundaries
    if (viewMode === 'summary' && dx > 0) return
    if (viewMode === 'chat' && dx < 0) return

    setSwipeOffset(dx)
  }, [viewMode])

  const handleSwipeEnd = useCallback(() => {
    if (!isHorizontal.current) {
      setSwipeOffset(0)
      setIsSwiping(false)
      return
    }
    const threshold = 50
    if (swipeOffset < -threshold && viewMode === 'summary') {
      setViewMode('chat')
    } else if (swipeOffset > threshold && viewMode === 'chat') {
      setViewMode('summary')
    }
    setSwipeOffset(0)
    setIsSwiping(false)
  }, [swipeOffset, viewMode])

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

  // Calculate track position
  const baseTranslate = viewMode === 'chat' ? -50 : 0
  const dragPercent = (swipeOffset / window.innerWidth) * 100
  const trackTranslate = baseTranslate + dragPercent

  return (
    <div className="page case-detail-page">
      <div className="chat-header">
        <button className="chat-header__btn" onClick={() => viewMode === 'chat' ? setViewMode('summary') : navigate(-1)}>
          <span className="icon">‹</span>
        </button>
        <div className="chat-header__title">
          {caseData.display_name} · №{caseData.id}
        </div>
        <div style={{ width: 40 }} />
      </div>

      {/* Swipeable panels */}
      <div
        className="case-swipe-container"
        onTouchStart={handleSwipeStart}
        onTouchMove={handleSwipeMove}
        onTouchEnd={handleSwipeEnd}
      >
        <div
          className="case-swipe-track"
          style={{
            transform: `translateX(${trackTranslate}%)`,
            transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* Summary panel */}
          <div className="case-swipe-panel">
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
          </div>

          {/* Chat panel */}
          <div className="case-swipe-panel">
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
          <span className="chat-view-toggle-btn__icon">≡</span> Сводка
        </button>
        <button className={`chat-view-toggle-btn ${viewMode === 'chat' ? 'active' : ''}`} onClick={() => setViewMode('chat')}>
          <span className="chat-view-toggle-btn__icon">🔒</span> Переписка
        </button>
      </div>
    </div>
  )
}

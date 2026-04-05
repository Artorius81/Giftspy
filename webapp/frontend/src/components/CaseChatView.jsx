import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { getTargetEmoji } from '../pages/TargetDetail'
import { useNavigate } from 'react-router-dom'
import { showAlert } from '../utils/popup'

const POLL_INTERVAL = 3000

function formatTime(timestamp) {
  if (!timestamp) return ''
  try {
    const d = new Date(timestamp)
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function CaseChatView({ caseId, spyMode, isPremium, caseStatus, targetName, personaName, targetPhoto, targetDbId, onStatusChange }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [intercepting, setIntercepting] = useState(false)
  const messagesEndRef = useRef(null)
  const prevMsgCountRef = useRef(0)
  const inputAreaRef = useRef(null)
  const navigate = useNavigate()

  const isManualMode = caseStatus === 'manual_mode'
  const canIntercept = ['started', 'in_progress'].includes(caseStatus)
  const isDone = ['done', 'delivered', 'cancelled', 'error'].includes(caseStatus)

  const targetAvatar = targetPhoto
    ? <img src={targetPhoto} alt="" className="chat-avatar-img" />
    : <span>{targetDbId ? getTargetEmoji(targetDbId) : '👤'}</span>

  const loadChat = () => {
    api.getCaseChat(caseId)
      .then(newMessages => {
        setMessages(newMessages)
        if (newMessages.length > prevMsgCountRef.current) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
          }, 100)
        }
        prevMsgCountRef.current = newMessages.length
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (spyMode && isPremium) {
      loadChat()
      const interval = setInterval(loadChat, POLL_INTERVAL)
      return () => clearInterval(interval)
    } else {
      setLoading(false)
    }
  }, [caseId, spyMode, isPremium])

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [loading])

  // Handle mobile keyboard: move input above keyboard + scroll
  useEffect(() => {
    if (!window.visualViewport) return
    const vv = window.visualViewport
    const handleResize = () => {
      const el = inputAreaRef.current
      if (!el) return
      const keyboardHeight = window.innerHeight - vv.height
      if (keyboardHeight > 100) {
        el.style.bottom = `${keyboardHeight + 8}px`
        // Also scroll messages into view
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }, 50)
      } else {
        el.style.bottom = ''
      }
    }
    vv.addEventListener('resize', handleResize)
    return () => vv.removeEventListener('resize', handleResize)
  }, [])

  const handleSend = async () => {
    if (!inputText.trim() || !isManualMode || sending) return
    setSending(true)
    try {
      await api.sendChatMessage(caseId, inputText.trim())
      setMessages(prev => [...prev, {
        sender: 'ai',
        message: inputText.trim(),
        timestamp: new Date().toISOString()
      }])
      setInputText('')
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (e) {
      await showAlert(e.message)
    }
    setSending(false)
  }

  const handleIntercept = async () => {
    setIntercepting(true)
    try {
      await api.interceptCase(caseId)
      // Add system message locally
      setMessages(prev => [...prev, {
        sender: 'system',
        message: '🛑 Вы перехватили управление',
        timestamp: new Date().toISOString()
      }])
      onStatusChange?.('manual_mode')
    } catch (e) {
      await showAlert(e.message)
    }
    setIntercepting(false)
  }

  const handleReturnDetective = async () => {
    setIntercepting(true)
    try {
      const result = await api.returnDetective(caseId)
      if (result.ok) {
        // Add system message locally
        setMessages(prev => [...prev, {
          sender: 'system',
          message: '🕵️ Управление возвращено детективу',
          timestamp: new Date().toISOString()
        }])
        onStatusChange?.('in_progress')
      }
    } catch (e) {
      await showAlert(e.message)
    }
    setIntercepting(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // === Premium/Spy mode gates ===
  if (!isPremium) {
    return (
      <div className="chat-view">
        <div className="empty-state">
          <div className="empty-state__icon">👑</div>
          <div className="empty-state__title">Премиум-функция</div>
          <div className="empty-state__desc">Шпионский режим и перехват управления доступны только с подпиской Премиум</div>
          <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => navigate('/store')}>
            🛍 Купить Премиум
          </button>
        </div>
      </div>
    )
  }

  if (!spyMode) {
    return (
      <div className="chat-view">
        <div className="empty-state">
          <div className="empty-state__icon">🔒</div>
          <div className="empty-state__title">Шпионский режим отключён</div>
          <div className="empty-state__desc">Включите Шпионский режим в настройках, чтобы просматривать переписку.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-view">
      {/* Status Banner */}
      {isManualMode && (
        <div className="chat-status-banner chat-status-banner--manual">
          <span className="chat-status-banner__icon">🕹️</span>
          <span className="chat-status-banner__text">Вы управляете перепиской</span>
        </div>
      )}
      {canIntercept && (
        <div className="chat-status-banner chat-status-banner--active">
          <span className="chat-status-banner__icon">📡</span>
          <span className="chat-status-banner__text">Прямой эфир · {personaName?.split(' ').pop()}</span>
        </div>
      )}
      {isDone && (
        <div className="chat-status-banner chat-status-banner--done">
          <span className="chat-status-banner__icon">✅</span>
          <span className="chat-status-banner__text">Расследование завершено</span>
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            Сообщений пока нет. Детектив скоро начнёт допрос.
          </div>
        ) : (
          messages.map((msg, idx) => {
            if (msg.sender === 'system') {
              return (
                <div key={idx} className="chat-system-msg">
                  <span>{msg.message}</span>
                </div>
              )
            }

            const isDetective = msg.sender === 'ai'
            const msgTime = formatTime(msg.timestamp)
            // Show sender name only once per consecutive group
            const prevMsg = idx > 0 ? messages[idx - 1] : null
            const showSenderName = !prevMsg || prevMsg.sender !== msg.sender || prevMsg.sender === 'system'
            const senderDisplayName = isDetective
              ? (personaName || 'Детектив')
              : (targetName || 'Цель')
            return (
              <div key={idx} className={`chat-bubble-container ${isDetective ? 'right' : 'left'}`}>
                {!isDetective && (
                  <div className="chat-avatar">
                    {targetAvatar}
                  </div>
                )}
                <div>
                  {showSenderName && (
                    <div className={`chat-bubble__sender ${isDetective ? 'chat-bubble__sender--right' : ''}`}>
                      {senderDisplayName}
                    </div>
                  )}
                  <div className={`chat-bubble ${isDetective ? 'chat-bubble--agent' : 'chat-bubble--target'}`}>
                    <div className="chat-bubble__text">{msg.message}</div>
                    <div className="chat-bubble__meta">
                      <span className="chat-bubble__time">{msgTime}</span>
                      {isDetective && <span className="chat-bubble__icon">🕵️‍♂️</span>}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="chat-input-area" ref={inputAreaRef}>
        {isManualMode ? (
          <>
            <div className="chat-input-hint">Вы управляете перепиской</div>
            <div className="chat-input-wrapper chat-input-wrapper--manual">
              <button
                className="chat-input-action-btn chat-input-action-btn--return"
                onClick={handleReturnDetective}
                disabled={intercepting}
                title="Вернуть детектива"
              >
                {intercepting ? (
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                ) : (
                  <span>▶</span>
                )}
              </button>
              <input
                className="chat-input-field"
                placeholder="Написать сообщение..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="chat-send-btn"
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  <span className="chat-send-btn__arrow">→</span>
                )}
              </button>
            </div>
          </>
        ) : canIntercept ? (
          <>
            <div className="chat-input-hint">Поставьте детектива на паузу, чтобы написать</div>
            <div className="chat-input-wrapper">
              <button
                className="chat-input-action-btn"
                onClick={handleIntercept}
                disabled={intercepting}
                title="Поставить на паузу"
              >
                {intercepting ? (
                  <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                ) : (
                  <span>⏸</span>
                )}
              </button>
              <input
                className="chat-input-field"
                placeholder="Написать сообщение..."
                disabled
              />
              <div className="chat-send-btn chat-send-btn--disabled">
                <span className="chat-send-btn__arrow">→</span>
              </div>
            </div>
          </>
        ) : (
          null
        )}
      </div>
    </div>
  )
}

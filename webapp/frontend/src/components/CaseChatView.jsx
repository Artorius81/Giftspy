import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { getTargetEmoji } from '../pages/TargetDetail'

const POLL_INTERVAL = 3000 // 3 seconds for chat-like feel

export default function CaseChatView({ caseId, spyMode, caseStatus, targetName, personaName, targetPhoto, targetDbId, onStatusChange }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [intercepting, setIntercepting] = useState(false)
  const messagesEndRef = useRef(null)
  const prevMsgCountRef = useRef(0)

  const isManualMode = caseStatus === 'manual_mode'
  const canIntercept = ['started', 'in_progress'].includes(caseStatus)

  // Target avatar: photo or deterministic emoji
  const targetAvatar = targetPhoto
    ? <img src={targetPhoto} alt="" className="chat-avatar-img" />
    : <span>{targetDbId ? getTargetEmoji(targetDbId) : '👤'}</span>

  const loadChat = () => {
    api.getCaseChat(caseId)
      .then(newMessages => {
        setMessages(newMessages)
        // Scroll only if new messages arrived
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
    if (spyMode) {
      loadChat()
      // Poll for new messages like a real chat
      const interval = setInterval(loadChat, POLL_INTERVAL)
      return () => clearInterval(interval)
    } else {
      setLoading(false)
    }
  }, [caseId, spyMode])

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [loading])

  const handleSend = async () => {
    if (!inputText.trim() || !isManualMode || sending) return
    setSending(true)
    try {
      await api.sendChatMessage(caseId, inputText.trim())
      setMessages(prev => [...prev, { sender: 'ai', message: inputText.trim() }])
      setInputText('')
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
    } catch (e) {
      alert(e.message)
    }
    setSending(false)
  }

  const handleIntercept = async () => {
    setIntercepting(true)
    try {
      await api.interceptCase(caseId)
      onStatusChange?.('manual_mode')
    } catch (e) {
      alert(e.message)
    }
    setIntercepting(false)
  }

  const handleReturnDetective = async () => {
    if (!confirm('Вернуть управление детективу?')) return
    setIntercepting(true)
    try {
      const result = await api.returnDetective(caseId)
      if (result.ok) {
        onStatusChange?.('in_progress')
      }
    } catch (e) {
      alert(e.message)
    }
    setIntercepting(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
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
      <div className="chat-messages">
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">Сообщений пока нет</div>
        ) : (
          messages.map((msg, idx) => {
            const isDetective = msg.sender === 'ai'
            return (
              <div key={idx} className={`chat-bubble-container ${isDetective ? 'right' : 'left'}`}>
                {!isDetective && (
                  <div className="chat-avatar">
                    {targetAvatar}
                  </div>
                )}
                <div className={`chat-bubble ${isDetective ? 'chat-bubble--agent' : 'chat-bubble--target'}`}>
                  <div className="chat-bubble__text">{msg.message}</div>
                </div>
                {isDetective && (
                  <div className="chat-avatar">
                    {'🕵️‍♂️'}
                  </div>
                )}
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {isManualMode ? (
          <>
            <div className="chat-input-hint">Вы управляете перепиской</div>
            <div className="chat-input-row">
              <button
                className="chat-input-btn"
                onClick={handleReturnDetective}
                disabled={intercepting}
                title="Вернуть детективу"
              >
                🕵️
              </button>
              <input
                className="chat-input-field"
                placeholder="Написать от имени детектива..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="chat-input-btn send-btn"
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
              >
                {sending ? '⏳' : '→'}
              </button>
            </div>
          </>
        ) : canIntercept ? (
          <div className="chat-intercept-area">
            <div className="chat-input-hint">Перехватите управление, чтобы писать от имени детектива</div>
            <button
              className="btn btn--primary"
              onClick={handleIntercept}
              disabled={intercepting}
            >
              {intercepting ? '⏳ Перехват...' : '🕹 Перехватить управление'}
            </button>
          </div>
        ) : (
          <div className="chat-input-hint" style={{ textAlign: 'center', padding: '8px 0' }}>
            Расследование завершено
          </div>
        )}
      </div>
    </div>
  )
}

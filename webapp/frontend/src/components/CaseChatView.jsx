import { useState, useEffect, useRef } from 'react'
import api from '../api'
import { getTargetEmoji } from '../pages/TargetDetail'

import { useNavigate } from 'react-router-dom'

const POLL_INTERVAL = 3000 // 3 seconds for chat-like feel

export default function CaseChatView({ caseId, spyMode, isPremium, caseStatus, targetName, personaName, targetPhoto, targetDbId, onStatusChange }) {
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

  const navigate = useNavigate()

  if (!isPremium) {
    return (
      <div className="chat-view">
        <div className="empty-state">
          <div className="empty-state__icon">👑</div>
          <div className="empty-state__title">Премиум-функция</div>
          <div className="empty-state__desc">Шпионский режим и перехват управления доступны только с подпиской Premium</div>
          <button className="btn btn--primary" style={{ marginTop: 16 }} onClick={() => navigate('/store')}>
            🛍 Купить Premium
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
      <div className="chat-messages">
        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : messages.length === 0 ? (
          <div className="chat-empty">Сообщений пока нет</div>
        ) : (
          messages.map((msg, idx) => {
            const isDetective = msg.sender === 'ai'
            const msgTime = "14:03" // Mock time for design
            return (
              <div key={idx} className={`chat-bubble-container ${isDetective ? 'right' : 'left'}`}>
                {!isDetective && (
                  <div className="chat-avatar">
                    {targetAvatar}
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
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        {isManualMode ? (
          <div className="custom-msg-wrapper">
            <div className="custom-msg-title active">Вы управляете перепиской (детектив на паузе)</div>
            <div className="chat-input-row">
              <button
                className="chat-input-btn pause-btn active"
                onClick={handleReturnDetective}
                disabled={intercepting}
                title="Вернуть детективу"
              >
                🕵️
              </button>
              <input
                className="chat-input-field"
                placeholder="Написать сообщение..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button
                className="chat-input-btn send-btn"
                onClick={handleSend}
                disabled={!inputText.trim() || sending}
              >
                {sending ? '...' : '→'}
              </button>
            </div>
          </div>
        ) : canIntercept ? (
          <div className="custom-msg-wrapper">
            <div className="custom-msg-title clickable" onClick={handleIntercept}>
              Приостановить детектива, чтобы написать от себя
            </div>
            <div className="chat-input-row">
              <button
                className="chat-input-btn pause-btn"
                onClick={handleIntercept}
                disabled={intercepting}
              >
                {intercepting ? '⏳' : '||'}
              </button>
              <input
                className="chat-input-field"
                placeholder="Детектив ведет допрос..."
                disabled
              />
              <button
                className="chat-input-btn send-btn"
                disabled
              >
                →
              </button>
            </div>
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

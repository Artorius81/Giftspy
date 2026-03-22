import { useState, useEffect, useRef } from 'react'
import api from '../api'

export default function CaseChatView({ caseId, spyMode, targetName, personaName, onClose }) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (spyMode) {
      api.getCaseChat(caseId)
        .then(setMessages)
        .catch(console.error)
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [caseId, spyMode])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (!spyMode) {
    return (
      <div className="chat-view">
        <div className="empty-state">
          <div className="empty-state__icon">🔒</div>
          <div className="empty-state__title">Шпионский режим отключен</div>
          <div className="empty-state__desc">Включите Шпионский режим, чтобы просматривать переписку.</div>
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
            const isUser = msg.sender === 'user'
            return (
              <div key={idx} className={`chat-bubble-container ${isUser ? 'right' : 'left'}`}>
                {!isUser && (
                  <div className="chat-avatar">
                    {'👤'}
                  </div>
                )}
                <div className={`chat-bubble ${isUser ? 'chat-bubble--agent' : 'chat-bubble--target'}`}>
                  <div className="chat-bubble__text">{msg.message}</div>
                </div>
                {isUser && (
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
        <div className="chat-input-hint">Pause Sherlock to send a custom message</div>
        <div className="chat-input-row">
          <button className="chat-input-btn">⏸</button>
          <input 
            className="chat-input-field" 
            placeholder="Send a custom message..." 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button className="chat-input-btn send-btn" onClick={() => {}}>→</button>
        </div>
      </div>
    </div>
  )
}

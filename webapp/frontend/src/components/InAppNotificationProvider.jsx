import { createContext, useContext, useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../api'

const InAppNotificationContext = createContext(null)

export const useInAppNotification = () => useContext(InAppNotificationContext)

export default function InAppNotificationProvider({ children }) {
  const [toast, setToast] = useState(null)
  const location = useLocation()
  const navigate = useNavigate()

  // Track active cases and their last chat message count to find new replies
  const prevCasesRef = useRef({})
  const prevChatsRef = useRef({})
  const isFirstFetchRef = useRef(true)

  // Show a notification toast
  const showNotification = (notification) => {
    // Trigger lightweight Telegram haptic feedback on toast arrival
    try {
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('warning')
    } catch {}

    setToast({
      id: Date.now(),
      title: notification.title || 'Уведомление',
      desc: notification.desc || '',
      icon: notification.icon || '🕵️‍♂️',
      onClick: notification.onClick || null
    })
  }

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => {
      setToast(null)
    }, 5000)
    return () => clearTimeout(timer)
  }, [toast])

  // Periodic polling for status changes and target replies
  useEffect(() => {
    let active = true
    
    const checkCasesUpdates = async () => {
      try {
        const profile = await api.getProfile().catch(() => null)
        // Check if user has global dialogue/reports notifications enabled in their settings
        const isDialogueEnabled = profile?.notify_dialogue !== false
        const isReportsEnabled = profile?.notify_reports !== false

        if (!profile) return

        const cases = await api.getCases()
        if (!cases || !active) return

        const currentCasesMap = {}
        const activeCasesToFetchChat = []

        for (const c of cases) {
          currentCasesMap[c.id] = c
          if (['started', 'in_progress', 'manual_mode'].includes(c.status)) {
            activeCasesToFetchChat.push(c)
          }
        }

        // 1. Detect status changes
        if (!isFirstFetchRef.current) {
          for (const c of cases) {
            const prev = prevCasesRef.current[c.id]
            if (prev && prev.status !== c.status) {
              // Interrogation starts
              if (c.status === 'in_progress' && isDialogueEnabled) {
                showNotification({
                  title: 'Расследование началось',
                  desc: `Детектив ${c.persona} вышел на связь с ${c.display_name}! 🕵️‍♂️`,
                  icon: '🔍',
                  onClick: () => navigate(`/dossier/${c.id}`)
                })
              }
              // Interrogation needs manual input
              else if (c.status === 'manual_mode' && isDialogueEnabled) {
                showNotification({
                  title: 'Требуется ваше участие',
                  desc: `Цель ${c.display_name} задала сложный вопрос. Детективу нужна помощь! ⚠️`,
                  icon: '🤫',
                  onClick: () => navigate(`/dossier/${c.id}`)
                })
              }
              // Case Completed / Dossier ready
              else if (['done', 'delivered'].includes(c.status) && isReportsEnabled) {
                showNotification({
                  title: 'Расследование завершено!',
                  desc: `Сбор досье по цели ${c.display_name} успешно завершен! 🎉`,
                  icon: '🎉',
                  onClick: () => navigate(`/dossier/${c.id}`)
                })
              }
            }
          }
        }

        // 2. Detect new messages in active dialogues
        if (isDialogueEnabled) {
          for (const activeCase of activeCasesToFetchChat) {
            try {
              const chat = await api.getCaseChat(activeCase.id)
              if (!chat || !active) continue

              const prevCount = prevChatsRef.current[activeCase.id]
              
              if (prevCount !== undefined && chat.length > prevCount) {
                const lastMsg = chat[chat.length - 1]
                
                // Only alert if the message was sent by the target ('user') or the AI ('ai')
                // AND the user is not currently viewing that specific dossier details page
                const isViewingThisCase = location.pathname === `/dossier/${activeCase.id}`
                
                if (!isViewingThisCase && lastMsg) {
                  const senderName = lastMsg.sender === 'user' ? activeCase.display_name : `Детектив ${activeCase.persona}`
                  const cleanText = lastMsg.message.replace(/✏️ \[ред\.\]\s*/, '')
                  const truncated = cleanText.length > 60 ? cleanText.substring(0, 60) + '...' : cleanText

                  showNotification({
                    title: lastMsg.sender === 'user' ? 'Новый ответ цели' : 'Ответ детектива',
                    desc: `${senderName}: "${truncated}"`,
                    icon: lastMsg.sender === 'user' ? '💬' : '🕵️‍♂️',
                    onClick: () => navigate(`/dossier/${activeCase.id}`)
                  })
                }
              }
              
              // Persist chat message count
              prevChatsRef.current[activeCase.id] = chat.length
            } catch (err) {
              console.error(`Error checking chat updates for case ${activeCase.id}:`, err)
            }
          }
        }

        // Save current cases for next comparison
        prevCasesRef.current = currentCasesMap
        isFirstFetchRef.current = false
      } catch (e) {
        console.warn('Error polling for in-app updates:', e)
      }
    }

    // Run first check immediately, then poll every 10 seconds
    checkCasesUpdates()
    const interval = setInterval(checkCasesUpdates, 10000)

    return () => {
      active = false
      clearInterval(interval)
    }
  }, [location.pathname, navigate])

  const handleToastClick = () => {
    if (toast?.onClick) {
      toast.onClick()
    }
    setToast(null)
  }

  return (
    <InAppNotificationContext.Provider value={{ showNotification }}>
      {children}
      {toast && (
        <div 
          className="inapp-notification-toast"
          onClick={handleToastClick}
        >
          <span className="inapp-notification-toast-icon">{toast.icon}</span>
          <div className="inapp-notification-toast-content">
            <span className="inapp-notification-toast-title">{toast.title}</span>
            <span className="inapp-notification-toast-desc">{toast.desc}</span>
          </div>
        </div>
      )}
    </InAppNotificationContext.Provider>
  )
}

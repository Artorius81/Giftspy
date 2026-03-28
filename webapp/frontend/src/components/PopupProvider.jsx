import { useState, useEffect } from 'react'
import { registerPopupCallback } from '../utils/popup'
import './PopupProvider.css'

export default function PopupProvider() {
  const [popups, setPopups] = useState([])

  useEffect(() => {
    registerPopupCallback((popup) => {
      setPopups(prev => [...prev, { ...popup, id: Date.now() + Math.random() }])
    })
    return () => registerPopupCallback(null)
  }, [])

  if (popups.length === 0) return null

  const handleClose = (id, result, resolve) => {
    setPopups(prev => prev.filter(p => p.id !== id))
    if (resolve) resolve(result)
  }

  return (
    <div className="popup-overlay">
      {popups.map(popup => (
        <div key={popup.id} className="popup-modal">
          <div className="popup-modal__title">{popup.title}</div>
          <div className="popup-modal__message">{popup.message}</div>
          <div className="popup-modal__actions">
            {popup.type === 'confirm' && (
              <button 
                className="btn btn--secondary" 
                onClick={() => handleClose(popup.id, false, popup.resolve)}
              >
                Отмена
              </button>
            )}
            <button 
              className="btn btn--primary" 
              onClick={() => handleClose(popup.id, true, popup.resolve)}
            >
              ОК
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

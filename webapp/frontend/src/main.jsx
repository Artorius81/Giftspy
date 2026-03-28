import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Expand Telegram WebApp to full height
if (window.Telegram?.WebApp) {
  window.Telegram.WebApp.expand()
  window.Telegram.WebApp.ready()
}

// Apply saved theme immediately to prevent flash
const savedTheme = localStorage.getItem('giftspy-theme')
if (savedTheme) {
  document.documentElement.setAttribute('data-theme', savedTheme)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

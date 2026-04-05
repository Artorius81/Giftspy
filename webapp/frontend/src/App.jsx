import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Targets from './pages/Targets'
import TargetDetail from './pages/TargetDetail'
import NewCase from './pages/NewCase'
import Dossier from './pages/Dossier'
import CaseDetail from './pages/CaseDetail'
import Store from './pages/Store'
import Settings from './pages/Settings'
import ProfileEdit from './pages/ProfileEdit'
import PopupProvider from './components/PopupProvider'
import './styles/snackbar.css'

// Main tab routes where BottomNav should be visible
const MAIN_ROUTES = ['/', '/targets', '/new-case', '/profile/edit']

function SplashScreen({ onFinish }) {
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const holdTimer = setTimeout(() => setFading(true), 2000) // Show for 2s
    const removeTimer = setTimeout(() => onFinish(), 2400) // 400ms fade transition
    return () => {
      clearTimeout(holdTimer)
      clearTimeout(removeTimer)
    }
  }, [onFinish])

  return (
    <div className={`splash-screen ${fading ? 'fade-out' : ''}`} />
  )
}

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const showNav = MAIN_ROUTES.includes(location.pathname)
  const [showSplash, setShowSplash] = useState(true)

  // Telegram BackButton — show only on sub-pages (not main tabs)
  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return

    const handleBack = () => {
      navigate(-1)
    }

    if (!showNav) {
      webApp.BackButton.show()
      webApp.BackButton.onClick(handleBack)
    } else {
      webApp.BackButton.hide()
      webApp.BackButton.offClick(handleBack)
    }

    return () => {
      webApp.BackButton.offClick(handleBack)
    }
  }, [showNav, navigate])

  // Global keyboard fix: works in both MiniApp and browser
  useEffect(() => {
    const handleFocusIn = (e) => {
      const el = e.target
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        const scroll = () => el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        setTimeout(scroll, 100)
        setTimeout(scroll, 300)
        setTimeout(scroll, 600)
      }
    }

    const handleViewportResize = () => {
      if (!window.visualViewport) return
      const keyboardHeight = window.innerHeight - window.visualViewport.height
      document.documentElement.style.setProperty('--keyboard-height', `${Math.max(0, keyboardHeight)}px`)
      if (keyboardHeight > 100) {
        document.activeElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }

    document.addEventListener('focusin', handleFocusIn)
    window.visualViewport?.addEventListener('resize', handleViewportResize)

    return () => {
      document.removeEventListener('focusin', handleFocusIn)
      window.visualViewport?.removeEventListener('resize', handleViewportResize)
    }
  }, [])

  return (
    <>
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/targets" element={<Targets />} />
          <Route path="/targets/:id" element={<TargetDetail />} />
          <Route path="/new-case" element={<NewCase />} />
          <Route path="/dossier" element={<Dossier />} />
          <Route path="/dossier/:id" element={<CaseDetail />} />
          <Route path="/store" element={<Store />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/profile/edit" element={<ProfileEdit />} />
        </Routes>
        {showNav && <BottomNav />}
        <PopupProvider />
      </div>
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

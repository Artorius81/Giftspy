import { useEffect, useState } from 'react'
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

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const showNav = MAIN_ROUTES.includes(location.pathname)

  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return

    const handleBack = () => {
      // If history is empty, maybe it'll do nothing, but for usual app flows it works identically to hardware back button
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

  const [exitSnackbarVisible, setExitSnackbarVisible] = useState(false)

  useEffect(() => {
    if (location.pathname !== '/') return

    // Initialize trap via React Router state to avoid tracking issues
    if (!location.state || !location.state.trapInitialized) {
      navigate('/', { state: { trapInitialized: true, isTrap: true }, replace: true })
      navigate('/', { state: { trapInitialized: true, isTrap: false } })
      return
    }

    if (location.state.isTrap) {
      if (exitSnackbarVisible) {
        window.Telegram?.WebApp?.close()
      } else {
        setExitSnackbarVisible(true)
        // Reset the trap so next back press hits it again
        navigate('/', { state: { trapInitialized: true, isTrap: false } })
        setTimeout(() => setExitSnackbarVisible(false), 2000)
      }
    }
  }, [location, exitSnackbarVisible, navigate])

  // Global keyboard fix: scroll focused input into view
  useEffect(() => {
    const handleFocusIn = (e) => {
      const el = e.target
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        // Delay to let keyboard open first
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 300)
      }
    }
    document.addEventListener('focusin', handleFocusIn)
    return () => document.removeEventListener('focusin', handleFocusIn)
  }, [])

  return (
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
      {exitSnackbarVisible && (
        <div className="exit-snackbar">Нажмите ещё раз, чтобы выйти</div>
      )}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

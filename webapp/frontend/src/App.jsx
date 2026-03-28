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
const MAIN_ROUTES = ['/', '/targets', '/new-case', '/dossier', '/store']

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

    if (!window.history.state?.isTrap) {
      window.history.pushState({ isTrap: true }, '')
    }

    const handlePopState = (e) => {
      if (exitSnackbarVisible) {
        window.Telegram?.WebApp?.close()
      } else {
        setExitSnackbarVisible(true)
        window.history.pushState({ isTrap: true }, '')
        setTimeout(() => setExitSnackbarVisible(false), 2000)
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [location.pathname, exitSnackbarVisible])

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

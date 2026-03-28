import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
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

// Main tab routes where BottomNav should be visible
const MAIN_ROUTES = ['/', '/targets', '/new-case', '/dossier', '/store']

function AppContent() {
  const location = useLocation()
  const showNav = MAIN_ROUTES.includes(location.pathname)

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

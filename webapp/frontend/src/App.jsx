import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import Targets from './pages/Targets'
import TargetDetail from './pages/TargetDetail'
import NewCase from './pages/NewCase'
import Dossier from './pages/Dossier'
import CaseDetail from './pages/CaseDetail'
import Store from './pages/Store'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/targets" element={<Targets />} />
          <Route path="/targets/:id" element={<TargetDetail />} />
          <Route path="/new-case" element={<NewCase />} />
          <Route path="/dossier" element={<Dossier />} />
          <Route path="/dossier/:id" element={<CaseDetail />} />
          <Route path="/store" element={<Store />} />
        </Routes>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}

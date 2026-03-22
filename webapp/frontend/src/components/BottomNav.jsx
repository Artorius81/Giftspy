import { useLocation, useNavigate } from 'react-router-dom'

const tabs = [
  { path: '/', icon: '🏠', label: 'Главная' },
  { path: '/targets', icon: '👥', label: 'Цели' },
  { path: '/new-case', icon: '🔍', label: 'Новое дело' },
  { path: '/dossier', icon: '📁', label: 'Досье' },
  { path: '/store', icon: '🛍', label: 'Магазин' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="bottom-nav">
      {tabs.map(tab => (
        <button
          key={tab.path}
          className={`nav-item ${location.pathname === tab.path ? 'active' : ''}`}
          onClick={() => navigate(tab.path)}
        >
          <span className="icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

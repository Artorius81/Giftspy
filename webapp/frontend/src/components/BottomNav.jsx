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
          onClick={() => {
            if (tab.path === location.pathname) return;
            if (location.pathname === '/') {
              navigate(tab.path);
            } else if (tab.path === '/') {
              navigate(-1);
            } else {
              navigate(tab.path, { replace: true });
            }
          }}
        >
          <span className="icon">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  )
}

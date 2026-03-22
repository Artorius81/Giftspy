import { useNavigate } from 'react-router-dom'

const PRODUCTS = [
  {
    id: 'inv_1',
    icon: '🔍',
    title: '1 Расследование',
    desc: 'Пополнение баланса на 1 расследование',
    price: '99 ₽',
  },
  {
    id: 'inv_3',
    icon: '🔍×3',
    title: '3 Расследования',
    desc: 'Выгодный набор — скидка 17%',
    price: '249 ₽',
    badge: 'Выгодно',
  },
  {
    id: 'prem_1',
    icon: '👑',
    title: 'Premium (1 месяц)',
    desc: 'Безлимитные расследования + шпионский режим',
    price: '299 ₽',
    badge: 'Premium',
  },
]

export default function Store() {
  const navigate = useNavigate()

  const handleBuy = (productId) => {
    // Payments are handled through the bot for now
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.showAlert(
        'Для оплаты используйте бота.\nОткройте чат и нажмите "🏠 Мой профиль" → "🛍 Магазин"'
      )
    } else {
      alert('Оплата доступна через Telegram-бота')
    }
  }

  return (
    <div className="page">
      <div className="header">
        <h1 className="header__title">🛍 Магазин</h1>
      </div>

      <div style={{ marginBottom: 16, padding: '16px', background: 'var(--gradient-card)', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-md)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>👑 Premium включает:</div>
        <ul style={{ fontSize: 13, color: 'var(--text-secondary)', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>• Безлимитное количество дел</li>
          <li>• Шпионский режим (чтение переписок)</li>
          <li>• Приоритетная обработка дел</li>
        </ul>
      </div>

      {PRODUCTS.map(p => (
        <div key={p.id} className="card" onClick={() => handleBuy(p.id)}>
          <div className="card__header">
            <div className="card__avatar" style={{ fontSize: 24 }}>{p.icon}</div>
            <div className="card__info">
              <div className="card__name">{p.title}</div>
              <div className="card__sub">{p.desc}</div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
            <div style={{
              fontSize: 18, fontWeight: 700,
              background: 'var(--gradient-primary)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {p.price}
            </div>
            {p.badge && <span className="badge badge--success">{p.badge}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { getTargetEmoji } from './TargetDetail'
import { useData } from '../hooks/useData'
import { showAlert } from '../utils/popup'

export default function Targets() {
  const navigate = useNavigate()
  const { data: targets, loading, mutate } = useData('targets', api.getTargets)
  
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ identifier: '', name: '', habits: '', birthday: '' })
  const [creating, setCreating] = useState(false)

  const load = () => {
    api.getTargets()
      .then(mutate)
      .catch(console.error)
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.identifier.trim()) return
    setCreating(true)
    try {
      await api.createTarget({
        identifier: form.identifier.trim(),
        name: form.name.trim() || null,
        habits: form.habits.trim() || null,
        birthday: form.birthday.trim() || null,
      })
      setForm({ identifier: '', name: '', habits: '', birthday: '' })
      setShowAdd(false)
      load()
    } catch (err) {
      await showAlert(err.message)
    }
    setCreating(false)
  }

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>

  return (
    <div className="page">
      <div className="header">
        <div className="header__placeholder" />
        <h1 className="header__title">👥 Мои цели</h1>
        <div className="header__placeholder" />
      </div>

      {/* Add Button */}
      <button className="btn btn--primary" style={{ marginBottom: 16 }} onClick={() => setShowAdd(!showAdd)}>
        {showAdd ? '✕ Отмена' : '＋ Добавить цель'}
      </button>

      {/* Add Form */}
      {showAdd && (
        <form onSubmit={handleCreate} style={{ animation: 'fadeIn 0.25s ease' }}>
          <div className="card">
            <div className="input-group">
              <label>Юзернейм или телефон *</label>
              <input
                className="input"
                placeholder="@username или +7..."
                value={form.identifier}
                onChange={e => setForm({ ...form, identifier: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>Имя</label>
              <input
                className="input"
                placeholder="Как зовут?"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>Увлечения / зацепки</label>
              <textarea
                className="input"
                placeholder="Чем увлекается?"
                value={form.habits}
                onChange={e => setForm({ ...form, habits: e.target.value })}
              />
            </div>
            <div className="input-group">
              <label>День рождения</label>
              <input
                className="input"
                placeholder="ДД.ММ.ГГГГ"
                value={form.birthday}
                onChange={e => setForm({ ...form, birthday: e.target.value })}
              />
            </div>
            <button className="btn btn--primary" type="submit" disabled={creating}>
              {creating ? '⏳ Создание...' : '✅ Создать'}
            </button>
          </div>
        </form>
      )}

      {/* Target List */}
      {targets.length === 0 && !showAdd ? (
        <div className="empty-state">
          <div className="empty-state__icon">👤</div>
          <div className="empty-state__title">Нет целей</div>
          <div className="empty-state__desc">Добавьте целевого человека, чтобы начать расследование</div>
        </div>
      ) : (
        targets.map(t => (
          <div key={t.id} className="card" onClick={() => navigate(`/targets/${t.id}`)}>
            <div className="card__header">
              <div className="card__avatar">
                {t.photo ? <img src={t.photo} alt="" /> : getTargetEmoji(t.id)}
              </div>
              <div className="card__info">
                <div className="card__name">{t.name || t.identifier}</div>
                <div className="card__sub">{t.identifier}</div>
              </div>
            </div>
            {(t.birthday || t.habits) && (
              <div className="card__badges">
                {t.birthday && <span className="badge">🎂 {t.birthday}</span>}
                {t.habits && <span className="badge">{t.habits.length > 30 ? t.habits.slice(0, 30) + '...' : t.habits}</span>}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'
import { showAlert, showConfirm } from '../utils/popup'
import { timeAgo } from '../utils/timeAgo'

// Emoji pool for target avatars (deterministic based on target ID)
const AVATAR_EMOJIS = ['🐱', '🐶', '🦊', '🐼', '🐨', '🦁', '🐸', '🐧', '🦋', '🌸', '🌻', '🍀', '⭐', '🌙', '🎈', '🎀', '🧸', '🦄', '🐝', '🐬']

export function getTargetEmoji(targetId) {
  return AVATAR_EMOJIS[targetId % AVATAR_EMOJIS.length]
}

export default function TargetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: target, loading, mutate } = useData(`target_${id}`, () => api.getTarget(id))
  
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (target) {
      setForm({ name: target.name || '', habits: target.habits || '', birthday: target.birthday || '' })
    }
  }, [target])

  const load = () => {
    api.getTarget(id)
      .then(mutate)
      .catch(console.error)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateTarget(id, {
        name: form.name || null,
        habits: form.habits || null,
        birthday: form.birthday || null,
      })
      setEditing(false)
      load()
    } catch (err) { await showAlert(err.message) }
    setSaving(false)
  }

  const handleDelete = async () => {
    if (!await showConfirm('Удалить цель?')) return
    try {
      await api.deleteTarget(id)
      navigate('/targets', { replace: true })
    } catch (err) { await showAlert(err.message) }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      await showAlert('Пожалуйста, выберите изображение')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      await showAlert('Файл слишком большой (макс. 10 МБ)')
      return
    }
    setUploading(true)
    try {
      const result = await api.uploadTargetPhoto(id, file)
      mutate({ ...target, photo: result.photo })
    } catch (err) {
      await showAlert(err.message)
    }
    setUploading(false)
  }

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>
  if (!target) return <div className="page"><div className="empty-state"><div className="empty-state__title">Цель не найдена</div></div></div>

  const avatarEmoji = getTargetEmoji(target.id)

  return (
    <div className="page">
      <div className="header">
        <button className="header__back" onClick={() => navigate(-1)}>
          <span className="icon">‹</span>
        </button>
        <span className="header__title">Профиль цели</span>
        <div className="header__placeholder" />
      </div>

      {/* Profile */}
      <div className="profile-header">
        <div
          className="profile-header__avatar profile-header__avatar--editable"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="spinner" style={{ width: 32, height: 32 }} />
          ) : target.photo ? (
            <img src={target.photo} alt="" />
          ) : (
            avatarEmoji
          )}
          <div className="avatar-overlay">📷</div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handlePhotoUpload}
        />
        <button
          className="btn btn--secondary btn--small"
          style={{ margin: '12px auto 16px', display: 'flex', width: 'auto' }}
          onClick={() => fileInputRef.current?.click()}
        >
          {target.photo ? '📷 Изменить фото' : '📷 Добавить фото'}
        </button>
        <div className="profile-header__name">{target.name || target.identifier}</div>
        <div className="profile-header__id">{target.identifier}</div>
        {target.birthday && (
          <div style={{ marginTop: 6 }}>
            <span className="badge">🎂 {target.birthday}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button className="btn btn--primary" style={{ flex: 1 }} onClick={() => navigate(`/new-case?target=${target.identifier}`)}>
          🔍 Расследовать
        </button>
        <button className="btn btn--secondary" style={{ flex: 1 }} onClick={() => setEditing(!editing)}>
          ✏️ {editing ? 'Отмена' : 'Редактировать'}
        </button>
      </div>

      {/* Edit form */}
      {editing && (
        <form onSubmit={handleSave} style={{ animation: 'fadeIn 0.25s ease', marginBottom: 16 }}>
          <div className="card">
            <div className="input-group">
              <label>Имя</label>
              <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="input-group">
              <label>Увлечения</label>
              <textarea className="input" value={form.habits} onChange={e => setForm({ ...form, habits: e.target.value })} />
            </div>
            <div className="input-group">
              <label>День рождения</label>
              <input className="input" placeholder="ДД.ММ.ГГГГ" inputMode="numeric" maxLength={10} value={form.birthday} onChange={e => {
                let v = e.target.value.replace(/[^\d.]/g, '')
                const digits = v.replace(/\./g, '')
                if (digits.length >= 4) v = digits.slice(0,2) + '.' + digits.slice(2,4) + '.' + digits.slice(4,8)
                else if (digits.length >= 2) v = digits.slice(0,2) + '.' + digits.slice(2)
                else v = digits
                setForm({ ...form, birthday: v })
              }} />
            </div>
            <button className="btn btn--primary" type="submit" disabled={saving}>
              {saving ? '⏳' : '✅ Сохранить'}
            </button>
          </div>
        </form>
      )}

      {/* Habits */}
      {target.habits && !editing && (
        <>
          <div className="section-header">
            <div className="section-header__title">🎯 Увлечения</div>
          </div>
          <div className="card">
            <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{target.habits}</p>
          </div>
        </>
      )}

      {/* Wishlist */}
      <div className="section-header">
        <div className="section-header__title">🎁 Вишлист</div>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {target.wishlist?.length || 0} идей
        </span>
      </div>

      {target.wishlist && target.wishlist.length > 0 ? (
        (() => {
          // Group by holiday + case_date
          const groups = {}
          target.wishlist.forEach(w => {
            const key = `${w.holiday || 'Без повода'}__${w.case_date || ''}`
            if (!groups[key]) {
              groups[key] = { holiday: w.holiday || 'Без повода', date: w.case_date, items: [] }
            }
            groups[key].items.push(w)
          })
          return Object.values(groups).map((group, gi) => (
            <div key={gi} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>📂 {group.holiday}</span>
                {group.date && <span style={{ fontWeight: 400 }}>· {timeAgo(group.date)}</span>}
              </div>
              <div className="card">
                {group.items.map(w => (
                  <div key={w.id} className="wishlist-item">
                    <div className="wishlist-item__icon">{w.added_by === 'ai' ? '🤖' : '✍️'}</div>
                    <div>
                      <div className="wishlist-item__text">{w.description}</div>
                      {w.category && (
                        <div className="wishlist-item__source">{w.category}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        })()
      ) : (
        <div className="empty-state" style={{ padding: '24px 0' }}>
          <div className="empty-state__desc">Вишлист пока пуст. Отправьте детектива!</div>
        </div>
      )}

      {/* Delete */}
      <button className="btn btn--danger" style={{ marginTop: 16 }} onClick={handleDelete}>
        🗑 Удалить цель
      </button>
    </div>
  )
}

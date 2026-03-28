import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api'
import { useData } from '../hooks/useData'
import { showAlert } from '../utils/popup'

export default function ProfileEdit() {
  const navigate = useNavigate()
  const { data: profile, loading, mutate } = useData('profile', api.getProfile)

  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    nickname: '',
    birthday: '',
    description: '',
  })

  useEffect(() => {
    if (profile) {
      setForm({
        nickname: profile.nickname || '',
        birthday: profile.birthday || '',
        description: profile.description || '',
      })
    }
  }, [profile])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.updateProfile({
        nickname: form.nickname || null,
        birthday: form.birthday || null,
        description: form.description || null,
      })
      // Reload profile
      const updated = await api.getProfile()
      setProfile(updated)
      await showAlert('✅ Профиль обновлён!')
    } catch (err) {
      await showAlert(err.message)
    }
    setSaving(false)
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file
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
      const result = await api.uploadProfilePhoto(file)
      mutate({ ...profile, photo: result.photo })
    } catch (err) {
      await showAlert(err.message)
    }
    setUploading(false)
  }

  if (loading) return <div className="page"><div className="loading"><div className="spinner" /></div></div>
  if (!profile) return <div className="page"><div className="empty-state"><div className="empty-state__title">Ошибка загрузки</div></div></div>

  return (
    <div className="page">
      <div className="header">
        <button className="header__back" onClick={() => navigate('/')}>
          <span className="icon">‹</span>
        </button>
        <span className="header__title">✏️ Редактировать профиль</span>
        <div className="header__placeholder" />
      </div>

      {/* Photo */}
      <div className="profile-header">
        <div
          className="profile-header__avatar profile-header__avatar--editable"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="spinner" style={{ width: 32, height: 32 }} />
          ) : profile.photo && profile.photo !== 'None' ? (
            <img src={profile.photo} alt="" />
          ) : (
            '🕵️‍♂️'
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
          type="button"
          className="btn btn--secondary btn--small"
          style={{ margin: '12px auto 16px', display: 'flex', width: 'auto' }}
          onClick={() => fileInputRef.current?.click()}
        >
          {profile.photo && profile.photo !== 'None' ? '📷 Изменить фото' : '📷 Добавить фото'}
        </button>
      </div>

      {/* Edit Form */}
      <form onSubmit={handleSave}>
        <div className="card" style={{ marginTop: 8 }}>
          <div className="input-group">
            <label>🕵️ Никнейм</label>
            <input
              className="input"
              placeholder="Как вас зовут?"
              maxLength={32}
              value={form.nickname}
              onChange={e => setForm({ ...form, nickname: e.target.value })}
            />
            <span className="input-hint">{form.nickname.length}/32</span>
          </div>

          <div className="input-group">
            <label>🎂 День рождения</label>
            <input
              className="input"
              placeholder="ДД.ММ.ГГГГ"
              value={form.birthday}
              onChange={e => setForm({ ...form, birthday: e.target.value })}
            />
          </div>

          <div className="input-group">
            <label>📝 О себе</label>
            <textarea
              className="input"
              placeholder="Расскажите о себе..."
              maxLength={200}
              rows={3}
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
            />
            <span className="input-hint">{form.description.length}/200</span>
          </div>

          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? '⏳ Сохранение...' : '✅ Сохранить'}
          </button>
        </div>
      </form>
    </div>
  )
}

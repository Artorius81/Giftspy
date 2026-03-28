import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import { getTargetEmoji } from './TargetDetail'

const HOLIDAY_OPTIONS = [
  '🎂 День Рождения', '💐 8 Марта', '🛡 23 Февраля',
  '🎄 Новый Год', '💍 Годовщина', '🎁 Просто так'
]

const BUDGET_OPTIONS = [
  'До 1 000 ₽', 'До 3 000 ₽', 'До 5 000 ₽',
  'До 10 000 ₽', 'До 30 000 ₽', 'Неограничен'
]

const STEPS = ['target', 'holiday', 'context', 'persona', 'budget', 'confirm']

export default function NewCase() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [step, setStep] = useState(0)
  const [targets, setTargets] = useState([])
  const [personas, setPersonas] = useState([])
  const [personaIdx, setPersonaIdx] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Touch tracking for carousel
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const carouselRef = useRef(null)
  const isAnimating = useRef(false)

  const [targetDisplayName, setTargetDisplayName] = useState('')

  const [form, setForm] = useState({
    target: searchParams.get('target') || '',
    holiday: '',
    context: '',
    persona: '',
    budget: '',
  })

  useEffect(() => {
    api.getTargets().then(list => {
      setTargets(list)
      // If target was pre-selected via URL, find its display name
      const preselected = searchParams.get('target')
      if (preselected) {
        const found = list.find(t => t.identifier === preselected)
        if (found && found.name) setTargetDisplayName(found.name)
      }
    }).catch(console.error)
    api.getPersonas().then(setPersonas).catch(console.error)
    if (searchParams.get('target')) setStep(1)
  }, [])

  const currentStepKey = STEPS[step]

  const hasCustomHoliday = form.holiday && !HOLIDAY_OPTIONS.includes(form.holiday) && form.holiday !== 'Без повода'

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await api.createCase({
        target: form.target,
        holiday: form.holiday || 'Без повода',
        context: form.context || 'Нет данных',
        persona: form.persona,
        budget: form.budget || 'Не указан',
      })
      navigate('/dossier')
    } catch (err) {
      alert(err.message)
    }
    setSubmitting(false)
  }

  // Carousel navigation with animation
  const goToPersona = useCallback((newIdx) => {
    if (isAnimating.current || newIdx < 0 || newIdx >= personas.length || newIdx === personaIdx) return
    isAnimating.current = true
    setPersonaIdx(newIdx)
    setTimeout(() => { isAnimating.current = false }, 350)
  }, [personaIdx, personas.length])

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].clientX
    const diff = touchStartX.current - touchEndX.current
    const threshold = 50
    if (Math.abs(diff) > threshold) {
      if (diff > 0 && personaIdx < personas.length - 1) {
        goToPersona(personaIdx + 1)
      } else if (diff < 0 && personaIdx > 0) {
        goToPersona(personaIdx - 1)
      }
    }
  }

  return (
    <div className="page">
      <div className="header">
        <button className="header__back" onClick={() => step > 0 ? setStep(step - 1) : navigate('/')}>
          ← {step > 0 ? 'Назад' : 'Главная'}
        </button>
        <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{step + 1}/{STEPS.length}</span>
      </div>

      {/* Progress */}
      <div className="wizard-progress">
        {STEPS.map((s, i) => (
          <div key={s} className={`wizard-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
        ))}
      </div>

      {/* Step: Target */}
      {currentStepKey === 'target' && (
        <div className="wizard-step">
          <div className="wizard-step__title">🎯 Выберите цель</div>
          <div className="wizard-step__desc">Кого будем расследовать?</div>

          {targets.length > 0 && (
            <>
              <div className="section-header">
                <div className="section-header__title">Сохранённые цели</div>
              </div>
              {targets.map(t => (
                <div
                  key={t.id}
                  className={`card ${form.target === t.identifier ? 'selected' : ''}`}
                  style={form.target === t.identifier ? { borderColor: 'var(--accent)' } : {}}
                  onClick={() => { setForm({ ...form, target: t.identifier }); setTargetDisplayName(t.name || ''); setStep(1) }}
                >
                  <div className="card__header">
                    <div className="card__avatar">
                      {t.photo ? <img src={t.photo} alt="" /> : getTargetEmoji(t.id)}
                    </div>
                    <div className="card__info">
                      <div className="card__name">{t.name || t.identifier}</div>
                      <div className="card__sub">{t.identifier}</div>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          <div className="section-header">
            <div className="section-header__title">Или введите вручную</div>
          </div>
          <div className="input-group">
            <input
              className="input"
              placeholder="@username или +7..."
              value={form.target}
              onChange={e => setForm({ ...form, target: e.target.value })}
            />
          </div>
          <button className="btn btn--primary" disabled={!form.target} onClick={() => setStep(1)}>
            Далее →
          </button>
        </div>
      )}

      {/* Step: Holiday */}
      {currentStepKey === 'holiday' && (
        <div className="wizard-step">
          <div className="wizard-step__title">🎉 Какой повод?</div>
          <div className="wizard-step__desc">Выберите из вариантов или напишите свой</div>
          <div className="option-grid">
            {HOLIDAY_OPTIONS.map(h => (
              <div
                key={h}
                className={`option-item ${form.holiday === h ? 'selected' : ''}`}
                onClick={() => { setForm({ ...form, holiday: h }); setStep(2) }}
              >
                {h}
              </div>
            ))}
          </div>
          <div className="input-group" style={{ marginTop: 12 }}>
            <input
              className="input"
              placeholder="Или свой вариант..."
              value={hasCustomHoliday ? form.holiday : ''}
              onChange={e => setForm({ ...form, holiday: e.target.value })}
            />
          </div>
          {hasCustomHoliday ? (
            <button className="btn btn--primary" onClick={() => setStep(2)}>
              Далее →
            </button>
          ) : (
            <button className="btn btn--secondary" onClick={() => { setForm({ ...form, holiday: 'Без повода' }); setStep(2) }}>
              ⏩ Пропустить
            </button>
          )}
        </div>
      )}

      {/* Step: Context */}
      {currentStepKey === 'context' && (
        <div className="wizard-step">
          <div className="wizard-step__title">🧩 Зацепки</div>
          <div className="wizard-step__desc">Расскажите о человеке. Чем увлекается? Кем работает?</div>
          <div className="input-group">
            <textarea
              className="input"
              placeholder="Любит путешествия, работает дизайнером..."
              rows={4}
              value={form.context}
              onChange={e => setForm({ ...form, context: e.target.value })}
            />
          </div>
          <button className="btn btn--primary" onClick={() => setStep(3)}>
            {form.context ? 'Далее →' : '⏩ Пропустить'}
          </button>
        </div>
      )}

      {/* Step: Persona */}
      {currentStepKey === 'persona' && personas.length > 0 && (
        <div className="wizard-step">
          <div className="wizard-step__title">🕵️‍♂️ Выберите детектива</div>
          <div
            className="persona-touch-carousel"
            ref={carouselRef}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div
              className="persona-track"
              style={{
                transform: `translateX(-${personaIdx * 100}%)`,
                transition: 'transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              {personas.map((p, idx) => (
                <div key={idx} className="persona-slide">
                  <img src={p.photo} alt={p.name} className="persona-carousel__img" />
                  <div className="persona-carousel__name">{p.name}</div>
                  <div className="persona-carousel__desc">{p.desc}</div>
                  <button
                    className="btn btn--primary"
                    onClick={() => { setForm({ ...form, persona: p.name }); setStep(4) }}
                  >
                    ✅ Выбрать
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="persona-swipe-dots">
            {personas.map((_, idx) => (
              <div
                key={idx}
                className={`swipe-dot ${idx === personaIdx ? 'active' : ''}`}
                onClick={() => goToPersona(idx)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step: Budget */}
      {currentStepKey === 'budget' && (
        <div className="wizard-step">
          <div className="wizard-step__title">💵 Бюджет</div>
          <div className="wizard-step__desc">Выберите бюджет на подарок</div>
          <div className="option-grid">
            {BUDGET_OPTIONS.map(b => (
              <div
                key={b}
                className={`option-item ${form.budget === b ? 'selected' : ''}`}
                onClick={() => { setForm({ ...form, budget: b }); setStep(5) }}
              >
                {b}
              </div>
            ))}
          </div>
          <button className="btn btn--secondary" style={{ marginTop: 12 }} onClick={() => { setForm({ ...form, budget: 'Не указан' }); setStep(5) }}>
            ⏩ Пропустить
          </button>
        </div>
      )}

      {/* Step: Confirm */}
      {currentStepKey === 'confirm' && (
        <div className="wizard-step">
          <div className="wizard-step__title">✅ Подтверждение</div>
          <div className="card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
              <div><strong>🎯 Цель:</strong> {targetDisplayName || form.target}</div>
              <div><strong>🎉 Повод:</strong> {form.holiday || 'Без повода'}</div>
              <div><strong>🧩 Зацепки:</strong> {form.context || 'Нет данных'}</div>
              <div><strong>🕵️ Детектив:</strong> {form.persona}</div>
              <div><strong>💵 Бюджет:</strong> {form.budget || 'Не указан'}</div>
            </div>
          </div>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? '⏳ Отправка...' : '🚀 Начать расследование'}
          </button>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../api'
import { showAlert } from '../utils/popup'
import detectiveImg from '../assets/detective.png'

const SKILL_PRESETS = [
  { id: 'deduction', label: 'Дедукция 🧠', val: 90, color: '#6c5ce7' },
  { id: 'insight', label: 'Проницательность 👁️', val: 90, color: '#00cec9' },
  { id: 'politeness', label: 'Вежливость 🤝', val: 90, color: '#e84393' },
  { id: 'cuteness', label: 'Милота 🐾', val: 95, color: '#fdcb6e' },
  { id: 'charisma', label: 'Харизма 🏴‍☠️', val: 95, color: '#e17055' },
  { id: 'wisdom', label: 'Мудрость 🔮', val: 90, color: '#9b59b6' },
  { id: 'directness', label: 'Прямолинейность 💀', val: 85, color: '#2d3436' }
]

const AI_GENERATORS = [
  { id: 'imagen-3', name: 'Imagen 3 (Google)', desc: 'Превосходный художественный стиль' },
  { id: 'dall-e-3', name: 'DALL-E 3 (OpenAI)', desc: 'Высочайшая детализация' },
  { id: 'dall-e-2', name: 'DALL-E 2 (OpenAI)', desc: 'Быстрая классическая модель' }
]

const STEPS = [
  { num: 1, title: 'Личность', icon: '👨‍✈️' },
  { num: 2, title: 'Характер', icon: '📈' },
  { num: 3, title: 'Мозг ИИ', icon: '🧠' },
  { num: 4, title: 'Внешность', icon: '🖼️' }
]

export default function DetectiveCreate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  
  const fileInputRef = useRef(null)
  
  // Step Wizard State
  const [formStep, setFormStep] = useState(1)
  const [step4Ready, setStep4Ready] = useState(false)

  useEffect(() => {
    if (formStep === 4) {
      setStep4Ready(false)
      const t = setTimeout(() => {
        setStep4Ready(true)
      }, 400)
      return () => clearTimeout(t)
    } else {
      setStep4Ready(false)
    }
  }, [formStep])

  // Form states
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [aiDescription, setAiDescription] = useState('')
  const [specialty, setSpecialty] = useState('Секретное расследование 🕵️‍♂️')
  const [emojis, setEmojis] = useState('🕵️‍♂️, 🎁, ✨')
  const [openingPhrase, setOpeningPhrase] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  
  // Custom skills states
  const [selectedSkills, setSelectedSkills] = useState({
    deduction: true,
    insight: true,
    politeness: true
  })
  const [skillValues, setSkillValues] = useState({
    deduction: 90,
    insight: 90,
    politeness: 90,
    cuteness: 95,
    charisma: 95,
    wisdom: 90,
    directness: 85
  })
  
  // Custom skill adding
  const [customSkills, setCustomSkills] = useState([])
  const [newSkillLabel, setNewSkillLabel] = useState('')
  
  // Avatar states
  const [avatarType, setAvatarType] = useState('ai') // 'ai' or 'upload'
  const [photoUrl, setPhotoUrl] = useState(detectiveImg) // default photo url
  const [isAvatarSet, setIsAvatarSet] = useState(false)
  
  // AI Generation states
  const [aiPrompt, setAiPrompt] = useState('')
  const [selectedGenerator, setSelectedGenerator] = useState('imagen-3')
  const [generating, setGenerating] = useState(false)
  
  // Upload states
  const [uploading, setUploading] = useState(false)
  
  // Final submit state
  const [submitting, setSubmitting] = useState(false)

  // Configure Telegram Back Button
  useEffect(() => {
    const webApp = window.Telegram?.WebApp
    if (!webApp) return

    const handleBack = () => {
      if (formStep > 1) {
        triggerHaptic();
        setFormStep(prev => prev - 1);
      } else {
        navigate(-1)
      }
    }

    webApp.BackButton.show()
    webApp.BackButton.onClick(handleBack)

    return () => {
      webApp.BackButton.offClick(handleBack)
    }
  }, [navigate, formStep])

  // Load detective details if editing
  useEffect(() => {
    if (!editId) return
    
    const loadDetective = async () => {
      try {
        const p = await api.getPersona(editId)
        setName(p.name || '')
        setDescription(p.desc || '')
        setSpecialty(p.specialty || '')
        setEmojis(p.emojis || '')
        setIsPublic(p.is_public || false)
        setPhotoUrl(p.photo || detectiveImg)
        setIsAvatarSet(!!p.photo)
        
        // Parse opening phrase if embedded
        let promptText = p.ai_description || ''
        const phraseMarker = '\n\nТвоя коронная приветственная фраза при начале допроса: "'
        if (promptText.includes(phraseMarker)) {
          const parts = promptText.split(phraseMarker)
          promptText = parts[0]
          const phrasePart = parts[1] || ''
          const phrase = phrasePart.substring(0, phrasePart.indexOf('"'))
          setOpeningPhrase(phrase)
        }
        setAiDescription(promptText)

        // Parse skills
        const skillsData = p.skills || []
        const newSelected = {}
        const newValues = { ...skillValues }
        const newCustom = []

        skillsData.forEach(sk => {
          const cleanLabel = sk.label.trim()
          const preset = SKILL_PRESETS.find(sp => sp.label.trim() === cleanLabel)
          if (preset) {
            newSelected[preset.id] = true
            newValues[preset.id] = sk.val
          } else {
            const customId = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
            newCustom.push({
              id: customId,
              label: cleanLabel,
              val: sk.val,
              color: sk.color || '#a78bfa'
            })
            newSelected[customId] = true
            newValues[customId] = sk.val
          }
        })

        setSelectedSkills(newSelected)
        setSkillValues(newValues)
        setCustomSkills(newCustom)
      } catch (err) {
        showAlert('Не удалось загрузить детектива: ' + err.message)
      }
    }

    loadDetective()
  }, [editId])

  const triggerHaptic = (style = 'light') => {
    try {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred(style)
    } catch { }
  }

  // Handle skill preset toggling
  const handleToggleSkill = (skillId) => {
    triggerHaptic()
    const activeCount = Object.values(selectedSkills).filter(Boolean).length
    
    if (!selectedSkills[skillId] && activeCount >= 3) {
      showAlert('Вы можете активировать не более 3 характеристик одновременно!')
      return
    }
    
    setSelectedSkills(prev => ({
      ...prev,
      [skillId]: !prev[skillId]
    }))
  }

  // Handle range change
  const handleSkillValChange = (skillId, val) => {
    setSkillValues(prev => ({
      ...prev,
      [skillId]: parseInt(val, 10)
    }))
  }

  // Handle adding custom skill
  const handleAddCustomSkill = () => {
    if (!newSkillLabel.trim()) return
    const activeCount = Object.values(selectedSkills).filter(Boolean).length
    if (activeCount >= 3) {
      showAlert('Вы можете активировать не более 3 характеристик одновременно!')
      return
    }
    
    triggerHaptic('medium')
    const customId = `custom_${Date.now()}`
    const newSkill = {
      id: customId,
      label: newSkillLabel.trim(),
      val: 90,
      color: '#a78bfa'
    }
    
    setCustomSkills(prev => [...prev, newSkill])
    setSelectedSkills(prev => ({ ...prev, [customId]: true }))
    setSkillValues(prev => ({ ...prev, [customId]: 90 }))
    setNewSkillLabel('')
  }

  // Handle deleting custom skill
  const handleDeleteCustomSkill = (skillId) => {
    setCustomSkills(prev => prev.filter(cs => cs.id !== skillId))
    setSelectedSkills(prev => {
      const copy = { ...prev }
      delete copy[skillId]
      return copy
    })
    setSkillValues(prev => {
      const copy = { ...prev }
      delete copy[skillId]
      return copy
    })
  }

  // AI Generate Avatar
  const handleGenerateAvatar = async () => {
    if (!aiPrompt.trim()) {
      await showAlert('Пожалуйста, опишите внешность детектива')
      return
    }
    
    triggerHaptic('medium')
    setGenerating(true)
    try {
      const promptText = `A premium 3D isometric stylized character avatar of a detective. ${aiPrompt.trim()}. Game profile icon, dark atmospheric cyberpunk/noir background, highly detailed rendering.`
      const result = await api.generateAvatar(promptText, selectedGenerator)
      setPhotoUrl(result.photo_url)
      setIsAvatarSet(true)
      await showAlert('🎨 Аватар успешно сгенерирован!')
    } catch (err) {
      await showAlert(err.message)
    }
    setGenerating(false)
  }

  // Custom Photo Upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      await showAlert('Пожалуйста, выберите файл изображения')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      await showAlert('Размер файла превышает 10 МБ')
      return
    }

    triggerHaptic('medium')
    setUploading(true)
    try {
      const result = await api.uploadDetectiveAvatar(file)
      setPhotoUrl(result.photo_url)
      setIsAvatarSet(true)
      await showAlert('📸 Фото успешно загружено!')
    } catch (err) {
      await showAlert(err.message)
    }
    setUploading(false)
  }

  // Handle Wizard progressive validation
  const handleNextStep = () => {
    triggerHaptic('medium')
    if (formStep === 1) {
      if (!name.trim()) {
        showAlert('Пожалуйста, введите имя детектива')
        return
      }
      if (!description.trim()) {
        showAlert('Пожалуйста, введите описание для приложения')
        return
      }
    } else if (formStep === 2) {
      const activeCount = Object.values(selectedSkills).filter(Boolean).length
      if (activeCount === 0) {
        showAlert('Пожалуйста, активируйте хотя бы одну характеристику')
        return
      }
    } else if (formStep === 3) {
      if (!aiDescription.trim()) {
        showAlert('Пожалуйста, введите инструкцию-характер для ИИ')
        return
      }
    }
    setFormStep(prev => prev + 1)
  }

  // Submit Form
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (formStep < 4) {
      handleNextStep()
      return
    }

    if (formStep === 4 && !step4Ready) {
      return
    }

    setSubmitting(true)
    triggerHaptic('medium')
    
    try {
      // Build skills data array
      const skillsData = []
      // Presets
      SKILL_PRESETS.forEach(sp => {
        if (selectedSkills[sp.id]) {
          skillsData.push({
            label: sp.label,
            val: skillValues[sp.id],
            color: sp.color
          })
        }
      })
      // Custom skills
      customSkills.forEach(cs => {
        if (selectedSkills[cs.id]) {
          skillsData.push({
            label: cs.label,
            val: skillValues[cs.id],
            color: cs.color
          })
        }
      })
      
      const finalPrompt = openingPhrase.trim() 
        ? `${aiDescription.trim()}\n\nТвоя коронная приветственная фраза при начале допроса: "${openingPhrase.trim()}". Начни диалог именно с неё.`
        : aiDescription.trim()

      if (editId) {
        // Edit mode
        await api.updatePersona(editId, {
          name: name.trim(),
          description: description.trim(),
          ai_description: finalPrompt,
          photo_url: photoUrl,
          emojis: emojis.trim() || '🕵️‍♂️, 🎁, ✨',
          is_public: isPublic,
          specialty: specialty.trim() || 'Секретное расследование 🕵️‍♂️',
          skills: skillsData
        })
        try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch { }
        await showAlert('✨ Детектив успешно обновлен!')
      } else {
        // Creation mode
        await api.createPersona({
          name: name.trim(),
          description: description.trim(),
          ai_description: finalPrompt,
          photo_url: photoUrl,
          emojis: emojis.trim() || '🕵️‍♂️, 🎁, ✨',
          is_public: isPublic,
          specialty: specialty.trim() || 'Секретное расследование 🕵️‍♂️',
          skills: skillsData
        })
        try { window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success') } catch { }
        await showAlert('✨ Детектив успешно создан и добавлен в вашу карусель!')
      }

      navigate('/new-case', { replace: true })
    } catch (err) {
      await showAlert(err.message)
    }
    setSubmitting(false)
  }

  return (
    <div className="page page-profile-bg" style={{ paddingBottom: '90px' }}>
      
      <style>{`
        @keyframes marquee {
          0% { transform: translate3d(0, 0, 0); }
          100% { transform: translate3d(-50%, 0, 0); }
        }
        .animate-marquee {
          display: inline-block;
          white-space: nowrap;
          animation: marquee 20s linear infinite;
          padding-left: 20%;
        }
        .marquee-wrapper {
          overflow: hidden;
          white-space: nowrap;
          width: 100%;
        }
        
        .fade-in-step {
          animation: fadeInStep 0.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
        }
        @keyframes fadeInStep {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Page Header */}
      <div className="new-header" style={{ paddingBottom: '8px', borderBottom: 'none', background: 'transparent' }}>
        <button 
          className="wishlist-header-btn" 
          onClick={() => {
            if (formStep > 1) {
              triggerHaptic();
              setFormStep(prev => prev - 1);
            } else {
              navigate(-1);
            }
          }} 
          style={{ width: 36, height: 36 }}
          aria-label="Назад"
        >
          ‹
        </button>
        <span className="new-header-title" style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text)' }}>
          {editId ? 'Изменить детектива' : 'Создать детектива'}
        </span>
        <div style={{ width: 36 }} />
      </div>

      {/* Progressive Step Indicator Dashboard */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        position: 'relative',
        margin: '10px 4px 20px 4px',
        background: 'rgba(255,255,255,0.02)',
        borderRadius: '16px',
        padding: '12px 16px',
        border: '1px solid var(--card-border)',
        boxShadow: 'var(--shadow-glow-subtle)'
      }}>
        {/* Progress connecting lines */}
        <div style={{
          position: 'absolute',
          top: '32px',
          left: '42px',
          right: '42px',
          height: '2px',
          background: 'rgba(255,255,255,0.08)',
          zIndex: 1
        }} />
        <div style={{
          position: 'absolute',
          top: '32px',
          left: '42px',
          width: `${((formStep - 1) / 3) * 78}%`,
          height: '2px',
          background: 'linear-gradient(90deg, #a78bfa 0%, #f472b6 100%)',
          zIndex: 2,
          transition: 'width 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)'
        }} />

        {STEPS.map((s) => {
          const isActive = formStep === s.num;
          const isCompleted = formStep > s.num;
          return (
            <div key={s.num} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              zIndex: 3,
              flex: 1
            }}>
              <button
                type="button"
                onClick={() => {
                  if (isCompleted || s.num < formStep) {
                    triggerHaptic();
                    setFormStep(s.num);
                  }
                }}
                disabled={!isCompleted && s.num > formStep}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive 
                    ? 'linear-gradient(135deg, #a78bfa 0%, #6c5ce7 100%)'
                    : isCompleted
                      ? 'rgba(52, 211, 153, 0.12)'
                      : 'rgba(25,25,28,0.95)',
                  border: isActive
                    ? '2px solid #a78bfa'
                    : isCompleted
                      ? '2px solid #34d399'
                      : '2px solid var(--card-border)',
                  color: isActive ? '#fff' : isCompleted ? '#34d399' : 'var(--text-secondary)',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: (isCompleted || s.num < formStep) ? 'pointer' : 'default',
                  boxShadow: isActive ? '0 0 12px rgba(167, 139, 250, 0.4)' : 'none',
                  transition: 'all 0.3s ease'
                }}
              >
                {isCompleted ? '✓' : s.icon}
              </button>
              <span style={{
                fontSize: '10px',
                marginTop: '6px',
                fontWeight: isActive ? '800' : '600',
                color: isActive ? 'var(--text)' : 'var(--text-secondary)',
                transition: 'all 0.3s ease',
                textAlign: 'center'
              }}>
                {s.title}
              </span>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
        
        {/* STEP 1: BASIC INFORMATION */}
        {formStep === 1 && (
          <div className="fade-in-step" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card no-active-scale" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label style={{ color: 'var(--accent)', fontWeight: 700 }}>🕵️‍♂️ Имя детектива</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input
                    className="input"
                    placeholder="Например: Спецагент Коржик"
                    maxLength={32}
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    style={{ paddingRight: name ? '36px' : '16px', width: '100%' }}
                  />
                  {name && (
                    <button
                      type="button"
                      onClick={() => { triggerHaptic(); setName(''); }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="input-group">
                <label style={{ color: 'var(--accent)', fontWeight: 700 }}>📋 Описание для приложения</label>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <textarea
                    className="input"
                    placeholder="Коротко опишите детектива (будет видно в карточке)"
                    maxLength={150}
                    rows={2}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                    style={{ paddingRight: description ? '36px' : '16px', width: '100%' }}
                  />
                  {description && (
                    <button
                      type="button"
                      onClick={() => { triggerHaptic(); setDescription(''); }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '12px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  )}
                  <span className="input-hint">{description.length}/150</span>
                </div>
              </div>
            </div>

            <div className="card no-active-scale" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label style={{ color: 'var(--accent)', fontWeight: 700 }}>🔍 Специализация</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input
                    className="input"
                    placeholder="Например: Вынюхивание подарков 🐾"
                    maxLength={40}
                    value={specialty}
                    onChange={e => setSpecialty(e.target.value)}
                    style={{ paddingRight: specialty ? '36px' : '16px', width: '100%' }}
                  />
                  {specialty && (
                    <button
                      type="button"
                      onClick={() => { triggerHaptic(); setSpecialty(''); }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <div className="input-group">
                <label style={{ color: 'var(--accent)', fontWeight: 700 }}>✨ Любимые эмодзи детектива</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input
                    className="input"
                    placeholder="Например: 🐾, 🦴, 🐶"
                    maxLength={20}
                    value={emojis}
                    onChange={e => setEmojis(e.target.value)}
                    style={{ paddingRight: emojis ? '36px' : '16px', width: '100%' }}
                  />
                  {emojis && (
                    <button
                      type="button"
                      onClick={() => { triggerHaptic(); setEmojis(''); }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: SKILLS & CHARACTERISTICS */}
        {formStep === 2 && (
          <div className="fade-in-step" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card no-active-scale" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '15px' }}>📈 Настройка характеристик (выберите до 3)</label>
              
              {/* Sliding instruction warning text */}
              <div className="marquee-wrapper" style={{ background: 'rgba(255,255,255,0.02)', padding: '6px 0', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                <div className="animate-marquee" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Активируйте чекбоксы и настройте процентное соотношение слайдером. Вы можете добавить свои кастомные характеристики ниже! • Активируйте чекбоксы и настройте процентное соотношение слайдером. Вы можете добавить свои кастомные характеристики ниже!
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Presets */}
                {SKILL_PRESETS.map(sp => {
                  const isActive = !!selectedSkills[sp.id]
                  return (
                    <div key={sp.id} style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '12px',
                      padding: '10px 14px'
                    }}>
                      <div 
                        onClick={() => handleToggleSkill(sp.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <input 
                          type="checkbox" 
                          checked={isActive}
                          onChange={() => {}}
                          style={{
                            width: '18px',
                            height: '18px',
                            accentColor: 'var(--accent)',
                            cursor: 'pointer'
                          }}
                        />
                        <span style={{ fontWeight: 650, fontSize: '13.5px', color: isActive ? 'var(--text)' : 'var(--text-secondary)' }}>{sp.label}</span>
                      </div>

                      {isActive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={skillValues[sp.id]}
                            onChange={(e) => handleSkillValChange(sp.id, e.target.value)}
                            style={{
                              flex: 1,
                              height: '4px',
                              background: 'rgba(255,255,255,0.1)',
                              accentColor: sp.color,
                              borderRadius: '2px',
                              cursor: 'pointer'
                            }}
                          />
                          <span style={{ fontSize: '12px', fontWeight: 'bold', width: '36px', textAlign: 'right', color: sp.color }}>{skillValues[sp.id]}%</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Custom added skills with Delete button */}
                {customSkills.map(cs => {
                  const isActive = !!selectedSkills[cs.id]
                  return (
                    <div key={cs.id} style={{
                      background: 'rgba(255,255,255,0.01)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '12px',
                      padding: '10px 14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div 
                          onClick={() => handleToggleSkill(cs.id)}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', userSelect: 'none', flex: 1 }}
                        >
                          <input 
                            type="checkbox" 
                            checked={isActive}
                            onChange={() => {}}
                            style={{
                              width: '18px',
                              height: '18px',
                              accentColor: 'var(--accent)',
                              cursor: 'pointer'
                            }}
                          />
                          <span style={{ fontWeight: 650, fontSize: '13.5px', color: isActive ? 'var(--text)' : 'var(--text-secondary)' }}>{cs.label}</span>
                        </div>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic('medium');
                            handleDeleteCustomSkill(cs.id);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#ff7675',
                            fontSize: '14px',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Удалить навык"
                        >
                          🗑️
                        </button>
                      </div>

                      {isActive && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                          <input 
                            type="range" 
                            min="0" 
                            max="100" 
                            value={skillValues[cs.id]}
                            onChange={(e) => handleSkillValChange(cs.id, e.target.value)}
                            style={{
                              flex: 1,
                              height: '4px',
                              background: 'rgba(255,255,255,0.1)',
                              accentColor: cs.color,
                              borderRadius: '2px',
                              cursor: 'pointer'
                            }}
                          />
                          <span style={{ fontSize: '12px', fontWeight: 'bold', width: '36px', textAlign: 'right', color: cs.color }}>{skillValues[cs.id]}%</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Custom Skill adding section with Marquee placeholder support */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                  {/* Scrolling helper marquee for Custom Skill suggestions */}
                  <div className="marquee-wrapper" style={{ background: 'rgba(255,255,255,0.015)', padding: '6px 0', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                    <div className="animate-marquee" style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                      Свой навык (например: Мемы 💾, Обаяние ✨, Упорство 🎯, Харизма 🏴‍☠️, Скрытность 🤫) • Свой навык (например: Мемы 💾, Обаяние ✨, Упорство 🎯, Харизма 🏴‍☠️, Скрытность 🤫)
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', position: 'relative', alignItems: 'center' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: 1 }}>
                      <input 
                        className="input"
                        placeholder="Введите название вашего навыка..."
                        maxLength={20}
                        value={newSkillLabel}
                        onChange={e => setNewSkillLabel(e.target.value)}
                        style={{ fontSize: '12.5px', padding: '10px 32px 10px 12px', width: '100%', boxSizing: 'border-box' }}
                      />
                      {newSkillLabel && (
                        <button
                          type="button"
                          onClick={() => { triggerHaptic(); setNewSkillLabel(''); }}
                          style={{
                            position: 'absolute',
                            right: '10px',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '14px',
                            cursor: 'pointer',
                            padding: '4px'
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <button 
                      type="button"
                      onClick={handleAddCustomSkill}
                      className="btn btn--secondary btn--small"
                      style={{ width: 'auto', flexShrink: 0, padding: '10px 16px', borderRadius: '12px', margin: 0 }}
                    >
                      ＋ Добавить
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: AI DIRECTIVES & COGNITIVE LOGIC */}
        {formStep === 3 && (
          <div className="fade-in-step" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card no-active-scale" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="input-group">
                <label style={{ color: 'var(--accent)', fontWeight: 700 }}>🧠 ИИ-характер детектива (Промпт)</label>
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%' }}>
                  <textarea
                    className="input"
                    placeholder="Как детектив будет себя вести? Опишите его роль, характер, style общения, тон голоса, используемые словечки и манеры для ИИ..."
                    maxLength={2000}
                    rows={5}
                    value={aiDescription}
                    onChange={e => setAiDescription(e.target.value)}
                    required
                    style={{ paddingRight: aiDescription ? '36px' : '16px', width: '100%' }}
                  />
                  {aiDescription && (
                    <button
                      type="button"
                      onClick={() => { triggerHaptic(); setAiDescription(''); }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        top: '12px',
                        background: 'rgba(0,0,0,0.3)',
                        borderRadius: '50%',
                        width: '20px',
                        height: '20px',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  )}
                  <span className="input-hint">{aiDescription.length}/2000</span>
                </div>
              </div>

              <div className="input-group">
                <label style={{ color: 'var(--accent)', fontWeight: 700 }}>💬 Первая приветственная фраза (Необязательно)</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input
                    className="input"
                    placeholder="Уникальное приветствие, с которого начнется диалог"
                    maxLength={150}
                    value={openingPhrase}
                    onChange={e => setOpeningPhrase(e.target.value)}
                    style={{ paddingRight: openingPhrase ? '36px' : '16px', width: '100%' }}
                  />
                  {openingPhrase && (
                    <button
                      type="button"
                      onClick={() => { triggerHaptic(); setOpeningPhrase(''); }}
                      style={{
                        position: 'absolute',
                        right: '12px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-secondary)',
                        fontSize: '16px',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: VISUAL LOOK (AVATAR) & ACCESS RULES */}
        {formStep === 4 && (
          <div className="fade-in-step" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card no-active-scale" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '15px' }}>🖼️ Аватар детектива</label>
              
              {/* Avatar Preview */}
              <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 6px 0' }}>
                <div style={{
                  width: '120px',
                  height: '180px',
                  borderRadius: '16px',
                  border: isAvatarSet ? '2px solid var(--accent)' : '1px solid var(--card-border)',
                  background: 'rgba(255,255,255,0.02)',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: isAvatarSet ? '0 0 16px rgba(108, 92, 231, 0.15)' : 'none'
                }}>
                  {(generating || uploading) ? (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'rgba(0,0,0,0.6)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div className="spinner" style={{ width: '28px', height: '28px' }} />
                      <span style={{ fontSize: '11px', color: '#fff', fontWeight: 'bold' }}>
                        {generating ? 'Рисуем ИИ...' : 'Загрузка...'}
                      </span>
                    </div>
                  ) : null}
                  <img 
                    src={photoUrl} 
                    alt="Detective Avatar Preview" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                </div>
              </div>

              {/* Toggle Switch Tabs */}
              <div style={{
                display: 'flex',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--card-border)',
                borderRadius: '20px',
                padding: '3px',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <button
                  type="button"
                  onClick={() => { triggerHaptic(); setAvatarType('ai'); }}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: '17px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: avatarType === 'ai' ? 'var(--accent)' : 'transparent',
                    color: avatarType === 'ai' ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  🎨 Генератор ИИ
                </button>
                <button
                  type="button"
                  onClick={() => { triggerHaptic(); setAvatarType('upload'); }}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    borderRadius: '17px',
                    border: 'none',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: avatarType === 'upload' ? 'var(--accent)' : 'transparent',
                    color: avatarType === 'upload' ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  📁 Загрузить файл
                </button>
              </div>

              {/* Tab 1: AI Image Generator */}
              {avatarType === 'ai' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div className="input-group">
                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Опишите внешность детектива</label>
                    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%' }}>
                      <textarea
                        className="input"
                        placeholder="Например: Милый пушистый корги в костюме английского детектива, в очках и с лупой в зубах..."
                        maxLength={300}
                        rows={3}
                        value={aiPrompt}
                        onChange={e => setAiPrompt(e.target.value)}
                        style={{ paddingRight: aiPrompt ? '36px' : '16px', width: '100%' }}
                      />
                      {aiPrompt && (
                        <button
                          type="button"
                          onClick={() => { triggerHaptic(); setAiPrompt(''); }}
                          style={{
                            position: 'absolute',
                            right: '12px',
                            top: '12px',
                            background: 'rgba(0,0,0,0.3)',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 10
                          }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Generator selection pills */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>ИИ-модель генерации</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {AI_GENERATORS.map(g => {
                        const isSelected = selectedGenerator === g.id
                        return (
                          <div
                            key={g.id}
                            onClick={() => { triggerHaptic(); setSelectedGenerator(g.id); }}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 14px',
                              borderRadius: '12px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--accent)' : 'var(--card-border)',
                              background: isSelected ? 'rgba(108, 92, 231, 0.08)' : 'rgba(255,255,255,0.01)',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '12.5px', fontWeight: 700, color: isSelected ? 'var(--text)' : 'var(--text-secondary)' }}>{g.name}</div>
                              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>{g.desc}</div>
                            </div>
                            {isSelected && <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>✓</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <button
                    type="button" // CRITICAL FIX: Add explicit type="button" to prevent auto form submit!
                    onClick={handleGenerateAvatar}
                    disabled={generating || !aiPrompt.trim()}
                    className="btn btn--primary"
                    style={{ padding: '12px', margin: 0 }}
                  >
                    {generating ? '🎨 Генерируем...' : '🔮 Нарисовать аватар ИИ'}
                  </button>
                </div>
              )}

              {/* Tab 2: Custom Photo Upload */}
              {avatarType === 'upload' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', textAlign: 'center' }}>
                  {/* Scrolling warn banner */}
                  <div style={{
                    background: 'rgba(245, 158, 11, 0.08)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    overflow: 'hidden',
                    width: '100%',
                    boxSizing: 'border-box'
                  }}>
                    <span style={{ fontSize: '15px', zIndex: 2, background: 'rgba(24,24,28,0.98)', paddingRight: '4px' }}>⚠️</span>
                    <div className="marquee-wrapper" style={{ flex: 1 }}>
                      <div className="animate-marquee" style={{ fontSize: '11px', color: '#f59e0b', fontWeight: 600 }}>
                        Загруженный аватар перед публикацией пройдёт обязательную модерацию командой Giftspy на соответствие правилам сообщества. • Загруженный аватар перед публикацией пройдёт обязательную модерацию командой Giftspy на соответствие правилам сообщества.
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="btn btn--secondary"
                    style={{ padding: '12px', margin: 0 }}
                  >
                    📂 Выбрать файл на устройстве
                  </button>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                  />
                </div>
              )}
            </div>

            {/* Public Sharing Setting Card */}
            <div className="card no-active-scale" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '14.5px', color: 'var(--text)' }}>🌍 Сделать общедоступным</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.3' }}>
                  Другие пользователи Giftspy смогут найти вашего детектива в Библиотеке
                </div>
              </div>
              <button
                type="button"
                className={`settings-toggle-btn ${isPublic ? 'active' : ''}`}
                onClick={() => { triggerHaptic(); setIsPublic(!isPublic); }}
                style={{ width: '48px', flexShrink: 0 }}
              >
                <span className="settings-toggle-knob" />
              </button>
            </div>
          </div>
        )}

        {/* Wizard Control Navigation Buttons Footer */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
          {formStep > 1 && (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => { triggerHaptic(); setFormStep(prev => prev - 1); }}
              style={{ flex: 1, padding: '14px', borderRadius: '14px', margin: 0 }}
            >
              ⬅ Назад
            </button>
          )}
          
          {formStep < 4 ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleNextStep}
              style={{
                flex: 2,
                padding: '14px',
                borderRadius: '14px',
                margin: 0,
                background: 'linear-gradient(135deg, #a78bfa 0%, #6c5ce7 100%)',
                boxShadow: 'var(--shadow-glow-subtle)',
                fontWeight: 'bold'
              }}
            >
              Далее ➡
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn--primary"
              disabled={submitting || !step4Ready}
              style={{
                flex: 2,
                padding: '16px',
                fontSize: '16px',
                borderRadius: '14px',
                margin: 0,
                boxShadow: 'var(--shadow-glow)',
                background: 'linear-gradient(135deg, #a78bfa 0%, #f472b6 100%)',
                fontWeight: '800'
              }}
            >
              {submitting ? '⏳ Сохранение...' : (editId ? '✨ Сохранить изменения!' : '✨ Создать детектива!')}
            </button>
          )}
        </div>

      </form>
    </div>
  )
}

/**
 * Dynamic relative date formatting utility.
 * Shows "только что", "2 дня назад", "Неделю назад", "12 марта" etc.
 */

const MONTHS_SHORT = ['янв.', 'фев.', 'мар.', 'апр.', 'мая', 'июн.', 'июл.', 'авг.', 'сен.', 'окт.', 'ноя.', 'дек.']
const MONTHS_FULL = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']

export function timeAgo(dateStr) {
  if (!dateStr) return ''
  
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffSec < 60) return 'только что'
    if (diffMin < 60) return `${diffMin} мин. назад`
    if (diffHours < 24) {
      if (diffHours === 1) return 'час назад'
      if (diffHours < 5) return `${diffHours} часа назад`
      return `${diffHours} часов назад`
    }
    if (diffDays === 1) return 'вчера'
    if (diffDays === 2) return '2 дня назад'
    if (diffDays === 3) return '3 дня назад'
    if (diffDays <= 6) return `${diffDays} дней назад`
    if (diffDays <= 10) return 'неделю назад'
    if (diffDays <= 20) return '2 недели назад'
    if (diffDays <= 35) return 'месяц назад'
    
    // Show date: "12 марта" or "12 мар. 2025"
    const day = date.getDate()
    const month = MONTHS_FULL[date.getMonth()]
    const year = date.getFullYear()
    const currentYear = now.getFullYear()
    
    if (year === currentYear) {
      return `${day} ${month}`
    }
    return `${day} ${MONTHS_SHORT[date.getMonth()]} ${year}`
  } catch {
    return ''
  }
}

/**
 * Format a duration between two dates.
 * Returns e.g. "за 15 мин", "за 3 часа", "за 2 дня"
 */
export function formatDuration(startStr, endStr) {
  if (!startStr || !endStr) return ''
  try {
    const start = new Date(startStr)
    const end = new Date(endStr)
    const diffMs = end - start
    const diffMin = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMin / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffMin < 1) return ''
    if (diffMin < 60) return `${diffMin} мин.`
    if (diffHours < 24) {
      if (diffHours === 1) return '1 час'
      if (diffHours < 5) return `${diffHours} часа`
      return `${diffHours} часов`
    }
    if (diffDays === 1) return '1 день'
    if (diffDays < 5) return `${diffDays} дня`
    return `${diffDays} дней`
  } catch {
    return ''
  }
}

import { useState, useRef, useCallback } from 'react'

/**
 * TabView — swipeable horizontal tab container using percentages for scaling.
 *
 * Props:
 *   activeIndex   — controlled active tab index (0-based)
 *   onChangeIndex — (index) => void
 *   children      — tab panels (React elements)
 *   className     — optional extra class on root
 */
export default function TabView({ activeIndex, onChangeIndex, children, className = '' }) {
  const containerRef = useRef(null)
  const [dragOffset, setDragOffset] = useState(0) // offset in px for dragging
  const [dragging, setDragging] = useState(false)

  const startX = useRef(0)
  const startY = useRef(0)
  const decided = useRef(false)
  const horizontal = useRef(false)
  const currentOffset = useRef(0)

  const tabs = Array.isArray(children) ? children : [children]
  const count = tabs.length

  const onTouchStart = useCallback((e) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    decided.current = false
    horizontal.current = false
    currentOffset.current = 0
  }, [])

  const onTouchMove = useCallback((e) => {
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    if (!decided.current) {
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      decided.current = true
      horizontal.current = Math.abs(dx) > Math.abs(dy)
    }

    if (!horizontal.current) return

    // Prevent vertical scroll while swiping horizontally
    e.preventDefault()

    // Rubber-band at edges
    const atStart = activeIndex === 0 && dx > 0
    const atEnd = activeIndex === count - 1 && dx < 0
    const clamped = (atStart || atEnd) ? dx * 0.25 : dx

    currentOffset.current = clamped
    setDragOffset(clamped)
    if (!dragging) setDragging(true)
  }, [activeIndex, count, dragging])

  const onTouchEnd = useCallback(() => {
    if (!horizontal.current) return

    const containerWidth = containerRef.current?.offsetWidth || window.innerWidth
    const threshold = containerWidth * 0.2
    const offset = currentOffset.current

    if (offset < -threshold && activeIndex < count - 1) {
      onChangeIndex(activeIndex + 1)
    } else if (offset > threshold && activeIndex > 0) {
      onChangeIndex(activeIndex - 1)
    }

    setDragOffset(0)
    setDragging(false)
    currentOffset.current = 0
  }, [activeIndex, count, onChangeIndex])

  // Percent-based base translation. 
  // Track is `count * 100%` wide. 
  // To show tab N, we shift by N * (100 / count) %
  const baseTranslatePercent = -(activeIndex * (100 / count))
  
  // We apply drag offset in pixels on top of the percentage translation
  const transform = `translateX(calc(${baseTranslatePercent}% + ${dragOffset}px))`

  return (
    <div
      ref={containerRef}
      className={`tabview ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <div
        className="tabview__track"
        style={{
          width: `${count * 100}%`,
          transform,
          transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        {tabs.map((child, i) => (
          <div className="tabview__panel" key={i}>
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

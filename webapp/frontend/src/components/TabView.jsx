import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * TabView — swipeable horizontal tab container.
 *
 * Props:
 *   activeIndex   — controlled active tab index (0-based)
 *   onChangeIndex — (index) => void
 *   children      — tab panels (React elements)
 *   className     — optional extra class on root
 */
export default function TabView({ activeIndex, onChangeIndex, children, className = '' }) {
  const containerRef = useRef(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)

  const startX = useRef(0)
  const startY = useRef(0)
  const decided = useRef(false)
  const horizontal = useRef(false)
  const currentOffset = useRef(0)

  const tabs = Array.isArray(children) ? children : [children]
  const count = tabs.length

  // Measure container on mount and resize
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth)
      }
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

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

    const w = containerWidth || window.innerWidth
    const threshold = w * 0.2
    const offset = currentOffset.current

    if (offset < -threshold && activeIndex < count - 1) {
      onChangeIndex(activeIndex + 1)
    } else if (offset > threshold && activeIndex > 0) {
      onChangeIndex(activeIndex - 1)
    }

    setDragOffset(0)
    setDragging(false)
    currentOffset.current = 0
  }, [activeIndex, count, onChangeIndex, containerWidth])

  // Compute transform using measured width
  const w = containerWidth || 0
  const translateX = -(activeIndex * w) + dragOffset

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
          transform: `translateX(${translateX}px)`,
          transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        }}
      >
        {tabs.map((child, i) => (
          <div
            className="tabview__panel"
            key={i}
            style={{ width: w || '100%' }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}

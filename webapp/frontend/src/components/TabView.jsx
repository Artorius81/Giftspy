import { useState, useRef, useCallback } from 'react'

/**
 * TabView — horizontal tab container using percentages for scaling.
 * Swiping has been removed per user requirements.
 *
 * Props:
 *   activeIndex   — controlled active tab index (0-based)
 *   onChangeIndex — (index) => void
 *   children      — tab panels (React elements)
 *   className     — optional extra class on root
 */
export default function TabView({ activeIndex, onChangeIndex, children, className = '' }) {
  const containerRef = useRef(null)

  const tabs = Array.isArray(children) ? children : [children]
  const count = tabs.length

  // Percent-based base translation. 
  // Track is `count * 100%` wide. 
  // To show tab N, we shift by N * (100 / count) %
  const baseTranslatePercent = -(activeIndex * (100 / count))
  
  const transform = `translateX(${baseTranslatePercent}%)`

  return (
    <div
      ref={containerRef}
      className={`tabview ${className}`}
    >
      <div
        className="tabview__track"
        style={{
          width: `${count * 100}%`,
          transform,
          transition: 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
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

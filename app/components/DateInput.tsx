'use client'

import { useRef, useState, useEffect } from 'react'

/**
 * DateInput — drop-in replacement for <input type="date" className="input" />.
 *
 * Stored/emitted format: YYYY-MM-DD (unchanged — matches existing backend contracts).
 * Display format: DD/MM/YYYY (user-facing).
 *
 * Shorthand typing (resolved on blur or Enter):
 *   25122026      → 25/12/2026  (DDMMYYYY — 8 digits)
 *   25/12/2026    → 25/12/2026
 *   25-12-2026    → 25/12/2026
 *
 * Rejected (returns null → red border):
 *   251266        → invalid (ambiguous 6-digit DDMMYY — century not guessed)
 *
 * Calendar: clicking the calendar icon opens the native date picker (hidden input).
 */

interface DateInputProps {
  value: string                        // YYYY-MM-DD or ''
  onChange: (value: string) => void    // emits YYYY-MM-DD or ''
  className?: string
  placeholder?: string
  style?: React.CSSProperties
}

function toDisplay(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  return `${d}/${m}/${y}`
}

function parseShorthand(raw: string): string | null {
  const s = raw.trim()
  if (!s) return ''

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // Normalise separators to /
  const normalised = s.replace(/[-\.]/g, '/')

  let d: string, m: string, y: string

  if (/^\d{8}$/.test(s)) {
    // DDMMYYYY
    d = s.slice(0, 2); m = s.slice(2, 4); y = s.slice(4, 8)
  } else {
    const parts = normalised.split('/')
    if (parts.length !== 3) return null
    d = parts[0].padStart(2, '0')
    m = parts[1].padStart(2, '0')
    if (parts[2].length !== 4) return null
    y = parts[2]
  }

  const di = parseInt(d, 10)
  const mi = parseInt(m, 10)
  const yi = parseInt(y, 10)

  if (isNaN(di) || isNaN(mi) || isNaN(yi)) return null
  if (di < 1 || di > 31 || mi < 1 || mi > 12 || yi < 1900 || yi > 2100) return null

  const iso = `${String(yi).padStart(4, '0')}-${String(mi).padStart(2, '0')}-${String(di).padStart(2, '0')}`

  // Validate as a real date
  const date = new Date(iso)
  if (isNaN(date.getTime())) return null

  return iso
}

export default function DateInput({ value, onChange, className, placeholder, style }: DateInputProps) {
  const [text, setText] = useState(() => toDisplay(value))
  const [error, setError] = useState(false)
  const hiddenRef = useRef<HTMLInputElement>(null)

  // Sync display when value changes externally
  useEffect(() => {
    setText(toDisplay(value))
    setError(false)
  }, [value])

  function commit(raw: string) {
    if (!raw.trim()) {
      setError(false)
      setText('')
      onChange('')
      return
    }
    const iso = parseShorthand(raw)
    if (iso === null) {
      setError(true)
      return
    }
    setError(false)
    setText(toDisplay(iso))
    onChange(iso)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit((e.target as HTMLInputElement).value)
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    commit(e.target.value)
  }

  function handleCalendarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value
    setText(toDisplay(iso))
    setError(false)
    onChange(iso)
  }

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', width: '100%', ...style }}>
      <input
        className={className ?? 'input'}
        type="text"
        value={text}
        placeholder={placeholder ?? 'DD/MM/YYYY'}
        onChange={e => { setText(e.target.value); setError(false) }}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        style={{ paddingRight: '30px', borderColor: error ? 'var(--red, #dc2626)' : undefined }}
      />
      {/* Hidden native date input — opened by the calendar button */}
      <input
        ref={hiddenRef}
        type="date"
        value={value || ''}
        onChange={handleCalendarChange}
        tabIndex={-1}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '28px',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
          pointerEvents: 'none',
        }}
      />
      {/* Calendar icon button */}
      <button
        type="button"
        tabIndex={-1}
        onClick={() => hiddenRef.current?.showPicker?.()}
        style={{
          position: 'absolute',
          right: '6px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0',
          lineHeight: 1,
          color: 'var(--text-muted)',
          fontSize: '14px',
          opacity: 0.7,
        }}
        title="Open calendar"
      >
        📅
      </button>
    </div>
  )
}

import * as React from 'react'

import { cn, formatDateDMY } from '@/lib/utils'

function isoFromDisplay(text: string): string | null {
  const s = text.trim()
  if (!s) return ''
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const d = Number(slashMatch[1])
    const m = Number(slashMatch[2])
    const y = Number(slashMatch[3])
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1000 && y <= 9999) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  const dotMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/)
  if (dotMatch) {
    const d = Number(dotMatch[1])
    const m = Number(dotMatch[2])
    const y = Number(dotMatch[3])
    if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1000 && y <= 9999) {
      return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    }
  }
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`
  }
  return null
}

function DateFormattedInput({
  className,
  value,
  defaultValue,
  onChange,
  disabled,
  placeholder,
  ...props
}: React.ComponentProps<'input'>) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const initialVal = value !== undefined ? String(value ?? '') : String(defaultValue ?? '')
  const [display, setDisplay] = React.useState<string>(() =>
    initialVal ? formatDateDMY(initialVal, '') : ''
  )

  React.useEffect(() => {
    if (value !== undefined) {
      const strVal = String(value ?? '')
      setDisplay(strVal ? formatDateDMY(strVal, '') : '')
    }
  }, [value])

  const emitIsoChange = (isoValue: string) => {
    if (!onChange) return
    const targetEl = inputRef.current
    const syntheticEvent = {
      target: Object.assign(targetEl || {}, { value: isoValue }),
      currentTarget: Object.assign(targetEl || {}, { value: isoValue }),
      preventDefault: () => {},
      stopPropagation: () => {},
    } as unknown as React.ChangeEvent<HTMLInputElement>
    onChange(syntheticEvent)
  }

  const openNativePicker = () => {
    if (disabled || typeof document === 'undefined') return
    const el = inputRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const temp = document.createElement('input')
    temp.type = 'date'
    const currentIso = isoFromDisplay(display) || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : '')
    if (currentIso) temp.value = currentIso
    temp.style.position = 'fixed'
    temp.style.left = `${rect.left}px`
    temp.style.top = `${rect.bottom - 2}px`
    temp.style.width = '1px'
    temp.style.height = '1px'
    temp.style.opacity = '0'
    temp.style.pointerEvents = 'none'
    temp.style.zIndex = '99999'
    document.body.appendChild(temp)

    const cleanup = () => {
      if (temp.parentNode) temp.parentNode.removeChild(temp)
    }

    temp.addEventListener('change', () => {
      const pickedIso = temp.value
      if (pickedIso) {
        setDisplay(formatDateDMY(pickedIso, ''))
        emitIsoChange(pickedIso)
      } else {
        setDisplay('')
        emitIsoChange('')
      }
      cleanup()
    })
    temp.addEventListener('blur', cleanup)

    try {
      temp.showPicker?.()
    } catch {
      cleanup()
    }
  }

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value
    // Ako korisnik unosi samo znamenke bez kose crte, automatski dodaj "/"
    const digitsOnly = raw.replace(/\D/g, '')
    if (/^\d+$/.test(raw.replace(/\//g, '')) && raw.length >= display.length) {
      if (digitsOnly.length >= 5) {
        raw = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}/${digitsOnly.slice(4, 8)}`
      } else if (digitsOnly.length >= 3) {
        raw = `${digitsOnly.slice(0, 2)}/${digitsOnly.slice(2, 4)}`
      }
    }
    setDisplay(raw)
    const parsedIso = isoFromDisplay(raw)
    if (parsedIso !== null) {
      emitIsoChange(parsedIso)
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const parsedIso = isoFromDisplay(display)
    if (parsedIso) {
      setDisplay(formatDateDMY(parsedIso, ''))
      emitIsoChange(parsedIso)
    } else if (!display.trim()) {
      setDisplay('')
      emitIsoChange('')
    } else if (value !== undefined) {
      const strVal = String(value ?? '')
      setDisplay(strVal ? formatDateDMY(strVal, '') : '')
    }
    props.onBlur?.(e)
  }

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    const el = inputRef.current
    if (el && !disabled) {
      const rect = el.getBoundingClientRect()
      // Klik na desnu stranu polja (ikona kalendara, zadnjih 34px) otvara kalendar
      if (e.clientX >= rect.right - 34) {
        e.preventDefault()
        openNativePicker()
        return
      }
    }
    props.onClick?.(e)
  }

  return (
    <input
      {...props}
      ref={inputRef}
      type="text"
      inputMode="numeric"
      disabled={disabled}
      value={display}
      onChange={handleTextChange}
      onBlur={handleBlur}
      onClick={handleClick}
      onDoubleClick={() => openNativePicker()}
      placeholder={placeholder || 'DD/MM/YYYY'}
      data-slot="input"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect width='18' height='18' x='3' y='4' rx='2' ry='2'/%3E%3Cline x1='16' x2='16' y1='2' y2='6'/%3E%3Cline x1='8' x2='8' y1='2' y2='6'/%3E%3Cline x1='3' x2='21' y1='10' y2='10'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 0.65rem center',
        backgroundSize: '15px 15px',
        ...props.style,
      }}
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 pr-8 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
    />
  )
}

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  if (type === 'date') {
    return <DateFormattedInput className={className} {...props} />
  }
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        className,
      )}
      {...props}
    />
  )
}

export { Input }

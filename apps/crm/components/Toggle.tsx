'use client'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
  labelPosition?: 'left' | 'right'
  size?: 'sm' | 'md'
}

export default function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
  labelPosition = 'left',
  size = 'md',
}: ToggleProps) {
  const sizes = {
    sm: {
      track: 'w-9 h-5',
      knob: 'h-4 w-4',
      translate: 'translate-x-4',
    },
    md: {
      track: 'w-11 h-6',
      knob: 'h-5 w-5',
      translate: 'translate-x-5',
    },
  }

  const s = sizes[size]

  const toggle = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`
        relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent
        transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2
        focus-visible:ring-emerald-600 focus-visible:ring-offset-2
        ${s.track}
        ${checked ? 'bg-emerald-500' : 'bg-gray-200'}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <span
        aria-hidden="true"
        className={`
          pointer-events-none inline-block rounded-full bg-white shadow-lg
          ring-0 transition duration-200 ease-in-out
          ${s.knob}
          ${checked ? s.translate : 'translate-x-0'}
        `}
      />
    </button>
  )

  if (!label) {
    return toggle
  }

  return (
    <div className="flex items-center gap-2">
      {labelPosition === 'left' && (
        <span className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
          {label}
        </span>
      )}
      {toggle}
      {labelPosition === 'right' && (
        <span className={`text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
          {label}
        </span>
      )}
    </div>
  )
}

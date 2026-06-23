interface StatusDotProps {
  status: 'online' | 'connecting' | 'offline'
  label?: string
}

export default function StatusDot({ status, label }: StatusDotProps) {
  const dotStyles = {
    online: 'bg-accent animate-pulse',
    connecting: 'bg-yellow-400 animate-blink',
    offline: 'bg-red-500',
  }

  const labelColors = {
    online: 'text-accent',
    connecting: 'text-yellow-400',
    offline: 'text-red-500',
  }

  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`w-2 h-2 rounded-full ${dotStyles[status]}`}
      />
      {label && (
        <span className={`text-xs ${labelColors[status]}`}>
          {label}
        </span>
      )}
    </div>
  )
}

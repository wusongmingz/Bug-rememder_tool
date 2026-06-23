import { Pin, PinOff, Minus, X } from 'lucide-react'
import { useState, useEffect } from 'react'

export default function WindowControls() {
  const [isPinned, setIsPinned] = useState(true)

  useEffect(() => {
    // 从 store 读取置顶状态
    const api = (window as unknown as { electronAPI?: { storeGet: (key: string) => Promise<unknown> } }).electronAPI
    if (api) {
      api.storeGet('alwaysOnTop').then((val) => {
        if (val !== null && val !== undefined) setIsPinned(val as boolean)
      })
    }
  }, [])

  const handleTogglePin = async () => {
    const api = (window as unknown as { electronAPI?: { windowTogglePin: () => Promise<boolean> } }).electronAPI
    if (api) {
      const newState = await api.windowTogglePin()
      setIsPinned(newState)
    }
  }

  const handleMinimize = () => {
    const api = (window as unknown as { electronAPI?: { windowMinimize: () => void } }).electronAPI
    if (api) api.windowMinimize()
  }

  const handleClose = () => {
    const api = (window as unknown as { electronAPI?: { windowClose: () => void } }).electronAPI
    if (api) api.windowClose()
  }

  return (
    <div
      className="flex items-center gap-0.5"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
    >
      <button
        onClick={handleTogglePin}
        className={`w-6 h-6 flex items-center justify-center rounded
          transition-colors duration-150
          ${isPinned
            ? 'text-accent hover:bg-accent/20'
            : 'text-textSecondary hover:text-textPrimary hover:bg-white/10'
          }`}
        title={isPinned ? '取消置顶' : '置顶'}
      >
        {isPinned ? <Pin size={12} /> : <PinOff size={12} />}
      </button>

      <button
        onClick={handleMinimize}
        className="w-6 h-6 flex items-center justify-center rounded
          text-textSecondary hover:text-textPrimary hover:bg-white/10
          transition-colors duration-150"
        title="最小化到托盘"
      >
        <Minus size={12} />
      </button>

      <button
        onClick={handleClose}
        className="w-6 h-6 flex items-center justify-center rounded
          text-textSecondary hover:text-red-400 hover:bg-red-400/10
          transition-colors duration-150"
        title="关闭"
      >
        <X size={12} />
      </button>
    </div>
  )
}

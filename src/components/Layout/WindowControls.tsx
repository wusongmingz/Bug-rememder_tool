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
        className={`w-[14px] h-[14px] flex items-center justify-center rounded-full
          transition-colors duration-150 border border-transparent
          ${isPinned
            ? 'bg-accent/30 text-accent hover:bg-accent/50 border-accent/50'
            : 'bg-white/10 text-textSecondary hover:text-textPrimary hover:bg-white/20'
          }`}
        title={isPinned ? '取消置顶' : '置顶'}
      >
        {isPinned ? <Pin size={8} /> : <PinOff size={8} />}
      </button>

      <button
        onClick={handleMinimize}
        className="w-[14px] h-[14px] flex items-center justify-center rounded-full
          bg-white/10 text-textSecondary hover:bg-yellow-400/80 hover:text-black
          transition-colors duration-150"
        title="最小化到托盘"
      >
        <Minus size={8} />
      </button>

      <button
        onClick={handleClose}
        className="w-[14px] h-[14px] flex items-center justify-center rounded-full
          bg-white/10 text-textSecondary hover:bg-red-500/80 hover:text-white
          transition-colors duration-150"
        title="关闭"
      >
        <X size={8} />
      </button>
    </div>
  )
}

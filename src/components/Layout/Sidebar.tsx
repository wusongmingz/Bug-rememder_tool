import { Bug, CheckSquare, BarChart3, Settings } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { ViewType } from '@/types'
import { useState } from 'react'
import WindowControls from './WindowControls'
import SettingsPanel from '@/components/Settings/SettingsPanel'

const navItems: { icon: typeof Bug; view: ViewType; label: string }[] = [
  { icon: Bug, view: 'bugs', label: 'Bug 监控' },
  { icon: CheckSquare, view: 'todos', label: '待办事项' },
  { icon: BarChart3, view: 'stats', label: '统计' },
]

export default function Sidebar() {
  const { currentView, setCurrentView } = useSettingsStore()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)

  return (
    <>
      <aside
        className="relative z-10 flex flex-col items-center w-[60px] h-screen
          bg-[rgba(20,20,40,0.8)] backdrop-blur-md
          border-r border-[rgba(255,255,255,0.05)]"
      >
        {/* 顶部拖拽区域 + 窗口控制 */}
        <div
          className="w-full h-10 flex items-center justify-between px-1"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
          <div className="w-5 h-5 rounded-md bg-accent/20 flex items-center justify-center flex-shrink-0"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <span className="text-accent text-[9px] font-bold">B</span>
          </div>
          <WindowControls />
        </div>

        {/* 导航图标 */}
        <nav className="flex-1 flex flex-col items-center gap-2 mt-4">
          {navItems.map(({ icon: Icon, view, label }) => {
            const isActive = currentView === view
            return (
              <div
                key={view}
                className="relative"
                onMouseEnter={() => setHoveredItem(view)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <button
                  onClick={() => setCurrentView(view)}
                  className={`
                    relative w-10 h-10 flex items-center justify-center rounded-lg
                    transition-all duration-200 ease-in-out
                    ${isActive
                      ? 'text-accent bg-accent/10'
                      : 'text-textSecondary hover:text-textPrimary hover:bg-white/5'
                    }
                  `}
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                  {/* 左侧选中指示器 */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[13px] w-[2px] h-5 bg-accent rounded-r" />
                  )}
                  <Icon size={20} />
                </button>

                {/* Tooltip */}
                {hoveredItem === view && (
                  <div
                    className="absolute left-full top-1/2 -translate-y-1/2 ml-3
                      px-2 py-1 rounded-md bg-[rgba(20,20,40,0.95)] border border-[rgba(255,255,255,0.1)]
                      text-xs text-textPrimary whitespace-nowrap z-50"
                  >
                    {label}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* 底部设置按钮 */}
        <div className="mb-4 relative"
          onMouseEnter={() => setHoveredItem('settings')}
          onMouseLeave={() => setHoveredItem(null)}
        >
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 flex items-center justify-center rounded-lg
              text-textSecondary hover:text-textPrimary hover:bg-white/5
              transition-all duration-200 ease-in-out"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Settings size={20} />
          </button>
          {hoveredItem === 'settings' && (
            <div
              className="absolute left-full top-1/2 -translate-y-1/2 ml-3
                px-2 py-1 rounded-md bg-[rgba(20,20,40,0.95)] border border-[rgba(255,255,255,0.1)]
                text-xs text-textPrimary whitespace-nowrap z-50"
            >
              设置
            </div>
          )}
        </div>
      </aside>

      {/* 设置面板 */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}

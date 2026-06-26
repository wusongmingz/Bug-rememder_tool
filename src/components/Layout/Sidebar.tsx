import { Home, ClipboardList, Bug, Settings } from 'lucide-react'
import { useSettingsStore } from '@/stores/settingsStore'
import { useBugStore } from '@/stores/bugStore'
import { ViewType } from '@/types'
import { useState } from 'react'

import SettingsPanel from '@/components/Settings/SettingsPanel'

const navItems: { icon: typeof Bug; view: ViewType; label: string }[] = [
  { icon: Home, view: 'home', label: '首页' },
  { icon: ClipboardList, view: 'todos', label: '我的任务' },
  { icon: Bug, view: 'bugs', label: 'Bug 提醒' },
  // { icon: TrendingUp, view: 'progress', label: '开发进度' },
  // { icon: Users, view: 'team', label: '团队成员' },
  // { icon: BarChart3, view: 'stats', label: '统计报表' },
]

export default function Sidebar() {
  const { currentView, setCurrentView, username } = useSettingsStore()
  const { bugs } = useBugStore()
  const [showSettings, setShowSettings] = useState(false)

  const activeBugCount = bugs.filter(b => b.status === 'active').length

  return (
    <>
      <aside
        className="relative z-10 flex flex-col w-[180px] h-full
          bg-[rgba(20,20,40,0.8)] backdrop-blur-md
          border-r border-[rgba(255,255,255,0.05)]"
      >
        <div className="h-4 flex-shrink-0" />

        {/* 导航列表 */}
        <nav className="flex-1 flex flex-col gap-0.5 px-2 mt-2">
          {navItems.map(({ icon: Icon, view, label }) => {
            const isActive = currentView === view
            return (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                className={`
                  relative flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left
                  transition-all duration-200 ease-in-out text-sm
                  ${isActive
                    ? 'text-accent bg-[#00ff88]/10 border-l-2 border-[#00ff88]'
                    : 'text-textSecondary hover:text-textPrimary hover:bg-white/5 border-l-2 border-transparent'
                  }
                `}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span className="truncate">{label}</span>
                {/* Bug 提醒带红色数字badge */}
                {view === 'bugs' && activeBugCount > 0 && (
                  <span className="ml-auto text-[10px] bg-red-500/90 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
                    {activeBugCount}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* 设置按钮 */}
        <div className="px-2 mb-2">
          <button
            onClick={() => setShowSettings(true)}
            className={`
              relative flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-left
              transition-all duration-200 ease-in-out text-sm
              text-textSecondary hover:text-textPrimary hover:bg-white/5 border-l-2 border-transparent
            `}
          >
            <Settings size={16} className="flex-shrink-0" />
            <span>设置</span>
          </button>
        </div>

        {/* 底部用户卡片 */}
        <div className="px-3 pb-3 border-t border-white/5 pt-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* 像素风格头像占位 */}
            <div className="w-8 h-8 rounded-md bg-accent/20 flex items-center justify-center flex-shrink-0">
              <span className="text-accent text-xs font-bold">P</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-textPrimary font-medium truncate">{username || '开发者'}</div>
            </div>
          </div>
          {/* EXP 经验条 */}
          {/* <div className="mt-2">
            <div className="flex justify-between text-[10px] text-textSecondary mb-0.5">
              <span>EXP</span>
              <span>620 / 1000</span>
            </div>
            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-accent/80 rounded-full" style={{ width: '62%' }} />
            </div>
          </div> */}
        </div>
      </aside>

      {/* 设置面板 */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </>
  )
}

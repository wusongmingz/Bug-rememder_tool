import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSettingsStore } from '@/stores/settingsStore'
import Sidebar from './Sidebar'
import TodoPanel from '@/components/Todo/TodoPanel'
import { ViewType } from '@/types'
import BugDashboard from '@/components/Bug/BugDashboard'
import StatsPanel from '@/components/Stats/StatsPanel'

// 占位页面组件
function PlaceholderPage({ title, icon }: { title: string; icon: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center h-full text-textSecondary">
      <span className="text-4xl mb-4">{icon}</span>
      <h2 className="text-xl font-semibold text-textPrimary">{title}</h2>
      <p className="text-sm mt-2">即将上线...</p>
    </div>
  )
}

const viewConfig: Record<ViewType, { title: string; icon: string }> = {
  home: { title: '首页', icon: '🏠' },
  bugs: { title: 'Bug 提醒', icon: '🐛' },
  todos: { title: '我的任务', icon: '✅' },
  progress: { title: '开发进度', icon: '📈' },
  team: { title: '团队成员', icon: '👥' },
  stats: { title: '统计报表', icon: '📊' },
  settings: { title: '设置', icon: '⚙️' },
}

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

function renderView(view: ViewType) {
  switch (view) {
    case 'bugs':
    case 'home':
      return <BugDashboard />
    case 'todos':
      return <TodoPanel />
    case 'stats':
      return <StatsPanel />
    default: {
      const { title, icon } = viewConfig[view]
      return <PlaceholderPage title={title} icon={icon} />
    }
  }
}

function HeaderClock() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const timeStr = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="flex items-center gap-3 text-xs text-textSecondary">
      <span className="flex items-center gap-1">
        <span>🌤</span>
        <span className="text-textPrimary">25°C</span>
      </span>
      <span className="w-px h-3 bg-white/10" />
      <span className="flex items-center gap-1">
        <span>📅</span>
        <span>{dateStr}</span>
        <span className="text-textPrimary ml-1">{timeStr}</span>
      </span>
    </div>
  )
}

export default function MainLayout() {
  const { currentView } = useSettingsStore()

  return (
    <div className="flex flex-col h-screen bg-deep overflow-hidden">
      {/* Header */}
      <header
        className="h-10 flex items-center justify-between px-4 bg-[#0f0f23] border-b border-white/5 flex-shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <span className="text-base">🐞</span>
          <span className="text-sm font-semibold text-textPrimary tracking-wide">
            像素办公室 · Bug 提醒工具
          </span>
        </div>
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <HeaderClock />
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="h-full"
            >
              {renderView(currentView)}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

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
  bugs: { title: 'Bug Dashboard', icon: '🐛' },
  todos: { title: '待办事项', icon: '✅' },
  stats: { title: '数据统计', icon: '📊' },
}

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

function renderView(view: ViewType) {
  switch (view) {
    case 'bugs':
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

export default function MainLayout() {
  const { currentView } = useSettingsStore()

  return (
    <div className="flex h-screen bg-deep overflow-hidden">
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
  )
}

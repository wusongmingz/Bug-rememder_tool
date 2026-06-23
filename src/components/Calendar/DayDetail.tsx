import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format, isSameDay } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { X, CheckCircle2, Circle, Bug as BugIcon, CalendarCheck } from 'lucide-react'
import { useBugStore } from '@/stores/bugStore'
import { useTodoStore } from '@/stores/todoStore'
import GlassCard from '@/components/Shared/GlassCard'
import type { Bug, Todo } from '@/types'

interface DayDetailProps {
  selectedDate: Date | null
  onClose: () => void
}

const severityColors: Record<Bug['severity'], string> = {
  fatal: '#ff4444',
  critical: '#ff6b35',
  normal: '#4ecdc4',
  suggestion: '#8888aa',
}

const priorityLabels: Record<Todo['priority'], { text: string; color: string }> = {
  high: { text: '高', color: '#ff6b35' },
  medium: { text: '中', color: '#4ecdc4' },
  low: { text: '低', color: '#8888aa' },
}

export default function DayDetail({ selectedDate, onClose }: DayDetailProps) {
  const bugs = useBugStore((s) => s.bugs)
  const todos = useTodoStore((s) => s.todos)
  const toggleTodo = useTodoStore((s) => s.toggleTodo)

  const dayBugs = useMemo(() => {
    if (!selectedDate) return []
    return bugs.filter((bug) => {
      if (!bug.createdDate) return false
      const bugDate = new Date(bug.createdDate)
      return isSameDay(bugDate, selectedDate)
    })
  }, [bugs, selectedDate])

  const dayTodos = useMemo(() => {
    if (!selectedDate) return []
    return todos.filter((todo) => {
      if (!todo.dueDate) return false
      const todoDate = new Date(todo.dueDate)
      return isSameDay(todoDate, selectedDate)
    })
  }, [todos, selectedDate])

  const isEmpty = dayBugs.length === 0 && dayTodos.length === 0

  return (
    <AnimatePresence>
      {selectedDate && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="mt-3 overflow-hidden"
        >
          <GlassCard className="!p-4">
            {/* 标题行 */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-textPrimary font-medium">
                {format(selectedDate, 'M月d日 EEEE', { locale: zhCN })}
              </h3>
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-white/10 text-textSecondary hover:text-textPrimary transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {isEmpty ? (
              <div className="text-center py-6 text-textSecondary text-sm">
                当日无事项
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bug区 */}
                {dayBugs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <BugIcon size={14} className="text-warning" />
                      <span className="text-xs text-textSecondary font-medium">
                        Bug ({dayBugs.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {dayBugs.map((bug) => (
                        <div
                          key={bug.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/5"
                        >
                          <span
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: severityColors[bug.severity] }}
                          />
                          <span className="text-sm text-textPrimary truncate">
                            {bug.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 待办区 */}
                {dayTodos.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <CalendarCheck size={14} className="text-accent" />
                      <span className="text-xs text-textSecondary font-medium">
                        待办 ({dayTodos.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {dayTodos.map((todo) => (
                        <div
                          key={todo.id}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/5"
                        >
                          <button
                            onClick={() => toggleTodo(todo.id)}
                            className="flex-shrink-0 text-accent hover:scale-110 transition-transform"
                          >
                            {todo.completed ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <Circle size={16} className="text-textSecondary" />
                            )}
                          </button>
                          <span
                            className={`text-sm truncate flex-1 ${
                              todo.completed
                                ? 'line-through text-textSecondary'
                                : 'text-textPrimary'
                            }`}
                          >
                            {todo.title}
                          </span>
                          <span
                            className="text-[10px] px-1.5 py-0.5 rounded"
                            style={{
                              color: priorityLabels[todo.priority].color,
                              backgroundColor: `${priorityLabels[todo.priority].color}20`,
                            }}
                          >
                            {priorityLabels[todo.priority].text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

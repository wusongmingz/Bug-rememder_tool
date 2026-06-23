import { useState } from 'react'
import { motion } from 'framer-motion'
import { GripVertical, Pencil, Trash2 } from 'lucide-react'
import { Todo } from '@/types'
import { format, isPast, isToday } from 'date-fns'

interface TodoItemProps {
  todo: Todo
  index: number
  onToggle: (id: string) => void
  onEdit: (todo: Todo) => void
  onDelete: (id: string) => void
  onDragStart: (index: number) => void
  onDragOver: (e: React.DragEvent, index: number) => void
  onDrop: (index: number) => void
  dragOverIndex: number | null
}

const priorityColors: Record<string, string> = {
  high: '#ff6b35',
  medium: '#ffd93d',
  low: '#4ecdc4',
}

export default function TodoItem({
  todo,
  index,
  onToggle,
  onEdit,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  dragOverIndex,
}: TodoItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  const getDueDateColor = () => {
    if (!todo.dueDate) return 'text-textSecondary'
    const date = new Date(todo.dueDate)
    if (isPast(date) && !isToday(date)) return 'text-[#ff6b35]'
    if (isToday(date)) return 'text-orange-400'
    return 'text-textSecondary'
  }

  const formatDueDate = () => {
    if (!todo.dueDate) return ''
    return format(new Date(todo.dueDate), 'M/d')
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20, transition: { duration: 0.2 } }}
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={(e) => onDragOver(e as unknown as React.DragEvent, index)}
      onDrop={() => onDrop(index)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative flex items-center gap-3 px-3 py-3 rounded-lg
        cursor-grab active:cursor-grabbing
        transition-colors duration-150
        ${isHovered ? 'bg-white/[0.04]' : 'bg-transparent'}
        ${dragOverIndex === index ? 'border-t-2 border-accent' : 'border-t-2 border-transparent'}
      `}
    >
      {/* 拖拽手柄 */}
      <div className="text-textSecondary/50 hover:text-textSecondary transition-colors">
        <GripVertical size={16} />
      </div>

      {/* Checkbox */}
      <button
        onClick={() => onToggle(todo.id)}
        className={`
          w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0
          transition-all duration-200
          ${todo.completed
            ? 'bg-accent border-accent'
            : 'border-white/30 hover:border-accent'
          }
        `}
      >
        {todo.completed && (
          <motion.svg
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            width="12"
            height="12"
            viewBox="0 0 12 12"
          >
            <motion.path
              d="M2 6L5 9L10 3"
              fill="none"
              stroke="#0f0f23"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.3 }}
            />
          </motion.svg>
        )}
      </button>

      {/* 内容区 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm truncate transition-all duration-200 ${
              todo.completed
                ? 'line-through opacity-50 text-textSecondary'
                : 'text-textPrimary'
            }`}
          >
            {todo.title}
          </span>
        </div>
        {todo.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {todo.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent/80"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 右侧信息 */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* 优先级点 */}
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: priorityColors[todo.priority] }}
          title={`优先级: ${todo.priority}`}
        />

        {/* 到期时间 */}
        {todo.dueDate && (
          <span className={`text-xs ${getDueDateColor()}`}>
            {formatDueDate()}
          </span>
        )}

        {/* 操作按钮 */}
        <div
          className={`flex items-center gap-1 transition-opacity duration-150 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            onClick={() => onEdit(todo)}
            className="p-1 rounded hover:bg-white/10 text-textSecondary hover:text-accent transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => onDelete(todo.id)}
            className="p-1 rounded hover:bg-white/10 text-textSecondary hover:text-[#ff6b35] transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

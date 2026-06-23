import { useState, useEffect, useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useTodoStore } from '@/stores/todoStore'
import { Todo } from '@/types'
import GlassCard from '@/components/Shared/GlassCard'
import TodoItem from './TodoItem'
import TodoForm from './TodoForm'

export default function TodoPanel() {
  const {
    todos,
    filter,
    tagFilter,
    addTodo,
    updateTodo,
    deleteTodo,
    toggleTodo,
    reorderTodos,
    setFilter,
    setTagFilter,
    loadTodos,
  } = useTodoStore()

  const [showForm, setShowForm] = useState(false)
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    loadTodos()
  }, [loadTodos])

  // 所有标签
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    todos.forEach((t) => t.tags.forEach((tag) => tagSet.add(tag)))
    return Array.from(tagSet)
  }, [todos])

  // 筛选后的列表
  const filteredTodos = useMemo(() => {
    let result = [...todos].sort((a, b) => a.order - b.order)

    if (filter === 'active') {
      result = result.filter((t) => !t.completed)
    } else if (filter === 'completed') {
      result = result.filter((t) => t.completed)
    }

    if (tagFilter) {
      result = result.filter((t) => t.tags.includes(tagFilter))
    }

    return result
  }, [todos, filter, tagFilter])

  // 统计
  const completedCount = todos.filter((t) => t.completed).length
  const totalCount = todos.length

  // 拖拽处理
  const handleDragStart = (index: number) => {
    setDragSourceIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDrop = (targetIndex: number) => {
    if (dragSourceIndex !== null && dragSourceIndex !== targetIndex) {
      reorderTodos(dragSourceIndex, targetIndex)
    }
    setDragSourceIndex(null)
    setDragOverIndex(null)
  }

  // 表单提交
  const handleFormSubmit = (data: Omit<Todo, 'id' | 'createdAt' | 'order'>) => {
    if (editingTodo) {
      updateTodo(editingTodo.id, data)
      setEditingTodo(null)
    } else {
      addTodo(data)
    }
  }

  const handleEdit = (todo: Todo) => {
    setEditingTodo(todo)
    setShowForm(true)
  }

  const handleCloseForm = () => {
    setShowForm(false)
    setEditingTodo(null)
  }

  const filterOptions: { value: 'all' | 'active' | 'completed'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'active', label: '进行中' },
    { value: 'completed', label: '已完成' },
  ]

  return (
    <div className="h-full p-4 md:p-6 overflow-hidden flex flex-col">
      <GlassCard className="flex-1 flex flex-col overflow-hidden !p-0">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-lg font-semibold text-textPrimary">待办事项</h2>
          <button
            onClick={() => setShowForm(true)}
            className="w-8 h-8 rounded-full bg-accent flex items-center justify-center hover:bg-accent/80 transition-colors shadow-lg shadow-accent/20"
          >
            <Plus size={18} className="text-deep" />
          </button>
        </div>

        {/* 筛选栏 */}
        <div className="px-5 pb-3 space-y-2">
          {/* 状态筛选 */}
          <div className="flex gap-1">
            {filterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                  filter === opt.value
                    ? 'bg-accent/20 text-accent'
                    : 'text-textSecondary hover:text-textPrimary hover:bg-white/5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 标签筛选 */}
          {allTags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <span className="text-[10px] text-textSecondary mr-1 self-center">标签:</span>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  className={`px-2 py-0.5 rounded-full text-[10px] transition-all duration-200 ${
                    tagFilter === tag
                      ? 'bg-accent/20 text-accent'
                      : 'bg-white/5 text-textSecondary hover:bg-white/10'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 列表区 */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {filteredTodos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-textSecondary">
              <span className="text-3xl mb-2">📝</span>
              <p className="text-sm">暂无待办事项，点击 + 添加</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredTodos.map((todo, index) => (
                <TodoItem
                  key={todo.id}
                  todo={todo}
                  index={index}
                  onToggle={toggleTodo}
                  onEdit={handleEdit}
                  onDelete={deleteTodo}
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  dragOverIndex={dragOverIndex}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* 底部统计 */}
        <div className="px-5 py-3 border-t border-white/5 text-xs text-textSecondary">
          已完成 {completedCount}/{totalCount} 项
        </div>
      </GlassCard>

      {/* 模态表单 */}
      {showForm && (
        <TodoForm
          mode={editingTodo ? 'edit' : 'create'}
          todo={editingTodo || undefined}
          onClose={handleCloseForm}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  )
}

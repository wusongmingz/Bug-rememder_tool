import { useState, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Todo } from '@/types'

interface TodoFormProps {
  mode: 'create' | 'edit'
  todo?: Todo
  onClose: () => void
  onSubmit: (data: Omit<Todo, 'id' | 'createdAt' | 'order'>) => void
}

export default function TodoForm({ mode, todo, onClose, onSubmit }: TodoFormProps) {
  const [title, setTitle] = useState(todo?.title || '')
  const [description, setDescription] = useState(todo?.description || '')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(todo?.priority || 'medium')
  const [dueDate, setDueDate] = useState(todo?.dueDate || '')
  const [tags, setTags] = useState<string[]>(todo?.tags || [])
  const [tagInput, setTagInput] = useState('')

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()])
      }
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove))
  }

  const handleSubmit = () => {
    if (!title.trim()) return
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      completed: todo?.completed || false,
      completedAt: todo?.completedAt,
      priority,
      dueDate: dueDate || undefined,
      tags,
    })
    onClose()
  }

  const priorityOptions: { value: 'high' | 'medium' | 'low'; label: string; color: string }[] = [
    { value: 'high', label: '高', color: '#ff6b35' },
    { value: 'medium', label: '中', color: '#ffd93d' },
    { value: 'low', label: '低', color: '#4ecdc4' },
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-50 w-full max-w-md mx-4 bg-[rgba(30,30,60,0.95)] border border-white/10 rounded-xl p-6 shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-semibold text-textPrimary">
              {mode === 'create' ? '新增待办' : '编辑待办'}
            </h3>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 text-textSecondary hover:text-textPrimary transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Form */}
          <div className="space-y-4">
            {/* 标题 */}
            <div>
              <label className="text-xs text-textSecondary mb-1 block">标题 *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="待办事项标题..."
                className="w-full bg-black/30 border border-white/10 focus:border-accent rounded-lg px-3 py-2 text-sm text-textPrimary placeholder:text-textSecondary/50 outline-none transition-colors"
                autoFocus
              />
            </div>

            {/* 描述 */}
            <div>
              <label className="text-xs text-textSecondary mb-1 block">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="添加描述..."
                rows={3}
                className="w-full bg-black/30 border border-white/10 focus:border-accent rounded-lg px-3 py-2 text-sm text-textPrimary placeholder:text-textSecondary/50 outline-none transition-colors resize-none"
              />
            </div>

            {/* 优先级 */}
            <div>
              <label className="text-xs text-textSecondary mb-1 block">优先级</label>
              <div className="flex gap-2">
                {priorityOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPriority(opt.value)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 border ${
                      priority === opt.value
                        ? 'border-current opacity-100'
                        : 'border-white/10 opacity-60 hover:opacity-80'
                    }`}
                    style={{
                      color: opt.color,
                      backgroundColor: priority === opt.value ? `${opt.color}20` : 'transparent',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 到期时间 */}
            <div>
              <label className="text-xs text-textSecondary mb-1 block">到期时间</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-black/30 border border-white/10 focus:border-accent rounded-lg px-3 py-2 text-sm text-textPrimary outline-none transition-colors"
              />
            </div>

            {/* 标签 */}
            <div>
              <label className="text-xs text-textSecondary mb-1 block">标签（回车添加）</label>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="输入标签后按回车..."
                className="w-full bg-black/30 border border-white/10 focus:border-accent rounded-lg px-3 py-2 text-sm text-textPrimary placeholder:text-textSecondary/50 outline-none transition-colors"
              />
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs"
                    >
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="hover:text-white transition-colors"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-accent text-accent text-sm hover:bg-accent/10 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="px-4 py-2 rounded-lg bg-accent text-deep text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mode === 'create' ? '添加' : '保存'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

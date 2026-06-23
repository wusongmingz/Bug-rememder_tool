import { create } from 'zustand'
import { Todo } from '../types'

const defaultTodos: Todo[] = [
  { id: '1', title: '修复登录页面Bug', description: '用户反馈登录按钮偶尔无响应', completed: false, priority: 'high', dueDate: '2024-01-20', tags: ['bug', '前端'], createdAt: '2024-01-15T08:00:00Z', order: 0 },
  { id: '2', title: '编写单元测试', description: '覆盖核心业务逻辑', completed: false, priority: 'medium', dueDate: '2024-01-22', tags: ['测试'], createdAt: '2024-01-15T09:00:00Z', order: 1 },
  { id: '3', title: '更新API文档', description: '', completed: true, priority: 'low', tags: ['文档'], createdAt: '2024-01-14T10:00:00Z', completedAt: '2024-01-16T14:00:00Z', order: 2 },
  { id: '4', title: '代码Review - 支付模块', description: '检查安全性和性能', completed: false, priority: 'high', dueDate: '2024-01-18', tags: ['review', '后端'], createdAt: '2024-01-15T11:00:00Z', order: 3 },
  { id: '5', title: '准备周会演示', description: '整理本周进度和下周计划', completed: false, priority: 'medium', dueDate: '2024-01-19', tags: ['会议'], createdAt: '2024-01-16T08:00:00Z', order: 4 },
]

interface TodoState {
  todos: Todo[]
  filter: 'all' | 'active' | 'completed'
  tagFilter: string | null

  addTodo: (todo: Omit<Todo, 'id' | 'createdAt' | 'order'>) => void
  updateTodo: (id: string, updates: Partial<Todo>) => void
  deleteTodo: (id: string) => void
  toggleTodo: (id: string) => void
  reorderTodos: (startIndex: number, endIndex: number) => void
  setFilter: (filter: 'all' | 'active' | 'completed') => void
  setTagFilter: (tag: string | null) => void
  loadTodos: () => void
  saveTodos: () => void
}

export const useTodoStore = create<TodoState>((set, get) => ({
  todos: defaultTodos,
  filter: 'all',
  tagFilter: null,

  addTodo: (todo) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2)
    const todos = get().todos
    const newTodo: Todo = {
      ...todo,
      id,
      createdAt: new Date().toISOString(),
      order: todos.length,
    }
    set({ todos: [...todos, newTodo] })
    get().saveTodos()
  },

  updateTodo: (id, updates) => {
    set({
      todos: get().todos.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })
    get().saveTodos()
  },

  deleteTodo: (id) => {
    set({ todos: get().todos.filter((t) => t.id !== id) })
    get().saveTodos()
  },

  toggleTodo: (id) => {
    set({
      todos: get().todos.map((t) =>
        t.id === id
          ? {
              ...t,
              completed: !t.completed,
              completedAt: !t.completed ? new Date().toISOString() : undefined,
            }
          : t
      ),
    })
    get().saveTodos()
  },

  reorderTodos: (startIndex, endIndex) => {
    const todos = [...get().todos]
    const [removed] = todos.splice(startIndex, 1)
    todos.splice(endIndex, 0, removed)
    const reordered = todos.map((t, i) => ({ ...t, order: i }))
    set({ todos: reordered })
    get().saveTodos()
  },

  setFilter: (filter) => set({ filter }),
  setTagFilter: (tag) => set({ tagFilter: tag }),

  loadTodos: async () => {
    try {
      if (window.electronAPI?.storeGet) {
        const saved = await window.electronAPI.storeGet('todos')
        if (saved && Array.isArray(saved)) {
          set({ todos: saved })
        }
      } else {
        const saved = localStorage.getItem('todos')
        if (saved) {
          set({ todos: JSON.parse(saved) })
        }
      }
    } catch {
      // 加载失败使用默认数据
    }
  },

  saveTodos: async () => {
    const { todos } = get()
    try {
      if (window.electronAPI?.storeSet) {
        await window.electronAPI.storeSet('todos', todos)
      } else {
        localStorage.setItem('todos', JSON.stringify(todos))
      }
    } catch {
      // 保存失败静默处理
    }
  },
}))

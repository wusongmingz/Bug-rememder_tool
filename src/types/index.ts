export interface Bug {
  id: number
  title: string
  severity: 'fatal' | 'critical' | 'normal' | 'suggestion'
  status: string
  assignedTo: string
  assignedToRealName?: string
  createdDate: string
  resolvedDate?: string
}

export interface TeamMember {
  name: string
  account?: string   // 账号名（用于匹配当前用户）
  bugCount: number
  bugs: Bug[]
  isCurrentUser?: boolean  // 是否为当前登录用户
}

export interface Todo {
  id: string
  title: string
  description?: string
  completed: boolean
  priority: 'high' | 'medium' | 'low'
  dueDate?: string
  tags: string[]
  createdAt: string
  completedAt?: string
  order: number
}

export interface Settings {
  zentaoUrl: string
  username: string
  password: string
  pollInterval: number
  alwaysOnTop: boolean
  productId?: string
  selectedProductIds?: number[]  // 用户勾选的产品ID列表，空/undefined 表示全选
}

export type ViewType = 'bugs' | 'todos' | 'stats'

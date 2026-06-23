export interface Bug {
  id: number
  title: string
  severity: 'fatal' | 'critical' | 'normal' | 'suggestion'
  status: string
  assignedTo: string
  createdDate: string
  resolvedDate?: string
}

export interface TeamMember {
  name: string
  bugCount: number
  bugs: Bug[]
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
}

export type ViewType = 'bugs' | 'todos' | 'calendar' | 'stats'

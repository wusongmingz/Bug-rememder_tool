import { create } from 'zustand'
import { Bug, TeamMember } from '../types'

interface TrendPoint {
  date: string
  added: number
  resolved: number
}

interface BugState {
  bugs: Bug[]
  totalCount: number
  connectionStatus: 'online' | 'connecting' | 'offline'
  lastFetched: string | null
  trendData: TrendPoint[]
  teamMembers: TeamMember[]

  setBugs: (bugs: Bug[]) => void
  setConnectionStatus: (status: 'online' | 'connecting' | 'offline') => void
  setLastFetched: (time: string) => void
  addTrendPoint: (point: TrendPoint) => void
  setTeamMembers: (members: TeamMember[]) => void
}

export const useBugStore = create<BugState>((set) => ({
  bugs: [],
  totalCount: 0,
  connectionStatus: 'offline',
  lastFetched: null,
  trendData: [],
  teamMembers: [],

  setBugs: (bugs) =>
    set({
      bugs,
      totalCount: bugs.length,
    }),

  setConnectionStatus: (status) => set({ connectionStatus: status }),

  setLastFetched: (time) => set({ lastFetched: time }),

  addTrendPoint: (point) =>
    set((state) => {
      const newTrend = [...state.trendData, point]
      // 保持最近7天数据
      return { trendData: newTrend.slice(-7) }
    }),

  setTeamMembers: (members) => set({ teamMembers: members }),
}))

// 派生数据：按严重程度分类计数
export function useBugCounts() {
  const bugs = useBugStore((s) => s.bugs)
  const activeBugs = bugs.filter((b) => b.status === 'active')

  return {
    total: activeBugs.length,
    fatal: activeBugs.filter((b) => b.severity === 'fatal').length,
    critical: activeBugs.filter((b) => b.severity === 'critical').length,
    normal: activeBugs.filter((b) => b.severity === 'normal').length,
    suggestion: activeBugs.filter((b) => b.severity === 'suggestion').length,
  }
}

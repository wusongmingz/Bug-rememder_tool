import { useMemo } from 'react'
import { differenceInDays } from 'date-fns'
import { useBugStore } from '@/stores/bugStore'
import { useTodoStore } from '@/stores/todoStore'
import GlassCard from '@/components/Shared/GlassCard'
import PulseNumber from '@/components/Shared/PulseNumber'
import {
  BugResolutionChart,
  WeeklyWorkloadChart,
  TodoTrendChart,
  WorkRhythmChart,
} from './Charts'

export default function StatsPanel() {
  const bugs = useBugStore((s) => s.bugs)
  const todos = useTodoStore((s) => s.todos)

  // Bug总数
  const totalBugs = bugs.length

  // Bug解决率
  const resolvedCount = useMemo(
    () => bugs.filter((b) => b.status === 'resolved').length,
    [bugs]
  )
  const resolutionRate = totalBugs > 0 ? Math.round((resolvedCount / totalBugs) * 100) : 0

  // 待办完成率
  const completedCount = useMemo(
    () => todos.filter((t) => t.completed).length,
    [todos]
  )
  const completionRate = todos.length > 0 ? Math.round((completedCount / todos.length) * 100) : 0

  // 平均Bug存活天数（未解决的）
  const avgDays = useMemo(() => {
    const activeBugs = bugs.filter((b) => b.status !== 'resolved')
    if (activeBugs.length === 0) return 0
    const totalDays = activeBugs.reduce((sum, b) => {
      const days = differenceInDays(new Date(), new Date(b.createdDate))
      return sum + days
    }, 0)
    return Math.round((totalDays / activeBugs.length) * 10) / 10
  }, [bugs])

  const statCards = [
    { label: 'Bug总数', value: totalBugs, color: '#ff6b35' },
    { label: '解决率', value: resolutionRate, suffix: '%', color: '#00ff88' },
    { label: '待办完成', value: completionRate, suffix: '%', color: '#4ecdc4' },
    { label: '平均存活', value: avgDays, suffix: '天', color: '#8888aa' },
  ]

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      {/* 标题 */}
      <h1 className="text-base font-semibold text-textPrimary">工作统计</h1>

      {/* 统计卡片行 */}
      <div className="grid grid-cols-4 gap-2">
        {statCards.map((card) => (
          <GlassCard key={card.label} hoverable className="!p-3 flex flex-col items-center gap-1">
            <span className="text-[10px] text-textSecondary">{card.label}</span>
            <div className="flex items-baseline gap-0.5">
              <PulseNumber value={Number(card.value)} color={card.color} size="sm" />
              {card.suffix && (
                <span className="text-[10px] text-textSecondary">{card.suffix}</span>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* 图表行1 */}
      <div className="grid grid-cols-2 gap-3">
        <BugResolutionChart />
        <WeeklyWorkloadChart />
      </div>

      {/* 图表行2 */}
      <div className="grid grid-cols-2 gap-3">
        <TodoTrendChart />
        <WorkRhythmChart />
      </div>
    </div>
  )
}

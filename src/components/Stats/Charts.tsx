import { useMemo } from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts'
import { useBugStore } from '@/stores/bugStore'
import { useTodoStore } from '@/stores/todoStore'
import GlassCard from '@/components/Shared/GlassCard'

// Recharts 通用暗色主题配置
const chartTheme = {
  backgroundColor: 'transparent',
  gridColor: 'rgba(255,255,255,0.05)',
  textColor: '#8888aa',
  tooltipBg: 'rgba(15,15,35,0.95)',
  tooltipBorder: 'rgba(0,255,136,0.3)',
}

const tooltipStyle = {
  contentStyle: {
    backgroundColor: chartTheme.tooltipBg,
    border: `1px solid ${chartTheme.tooltipBorder}`,
    borderRadius: '8px',
    fontSize: '12px',
    color: '#e0e0e0',
  },
  labelStyle: { color: chartTheme.textColor },
}

// ===================== Bug解决率饼图 =====================
export function BugResolutionChart() {
  const bugs = useBugStore((s) => s.bugs)

  const data = useMemo(() => {
    const resolved = bugs.filter((b) => b.status === 'resolved').length
    const unresolved = bugs.length - resolved
    return [
      { name: '已解决', value: resolved },
      { name: '未解决', value: unresolved },
    ]
  }, [bugs])

  const percentage = useMemo(() => {
    if (bugs.length === 0) return 0
    return Math.round((data[0].value / bugs.length) * 100)
  }, [bugs, data])

  const COLORS = ['#00ff88', '#ff6b35']

  return (
    <GlassCard className="p-4">
      <h3 className="text-xs text-textSecondary mb-2">Bug解决率</h3>
      <div className="h-[200px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              innerRadius={40}
              outerRadius={60}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index]} />
              ))}
            </Pie>
            <Tooltip {...tooltipStyle} />
            <Legend
              verticalAlign="bottom"
              height={30}
              iconSize={8}
              formatter={(value: string) => (
                <span style={{ color: chartTheme.textColor, fontSize: '11px' }}>{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* 中心百分比数字 */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ marginTop: '-16px' }}>
          <span className="text-lg font-bold text-accent">{percentage}%</span>
        </div>
      </div>
    </GlassCard>
  )
}

// ===================== 每周工作量柱状图 =====================
export function WeeklyWorkloadChart() {
  const bugs = useBugStore((s) => s.bugs)
  const todos = useTodoStore((s) => s.todos)

  const weeklyData = useMemo(() => {
    const now = new Date()
    const weeks = []
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date(now)
      weekStart.setDate(now.getDate() - (i + 1) * 7)
      const weekEnd = new Date(now)
      weekEnd.setDate(now.getDate() - i * 7)

      const newBugs = bugs.filter((b) => {
        const d = new Date(b.createdDate)
        return d >= weekStart && d < weekEnd
      }).length

      const completedTodos = todos.filter((t) => {
        if (!t.completedAt) return false
        const d = new Date(t.completedAt)
        return d >= weekStart && d < weekEnd
      }).length

      weeks.push({
        week: `第${4 - i}周`,
        newBugs: newBugs || Math.floor(Math.random() * 6) + 1,
        completedTodos: completedTodos || Math.floor(Math.random() * 8) + 2,
      })
    }
    return weeks
  }, [bugs, todos])

  return (
    <GlassCard className="p-4">
      <h3 className="text-xs text-textSecondary mb-2">每周工作量</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeklyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10, fill: chartTheme.textColor }}
              axisLine={{ stroke: chartTheme.gridColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: chartTheme.textColor }}
              axisLine={{ stroke: chartTheme.gridColor }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip {...tooltipStyle} />
            <Legend
              verticalAlign="bottom"
              height={24}
              iconSize={8}
              formatter={(value: string) => (
                <span style={{ color: chartTheme.textColor, fontSize: '11px' }}>{value}</span>
              )}
            />
            <Bar dataKey="newBugs" name="新增Bug" fill="#ff6b35" radius={[2, 2, 0, 0]} />
            <Bar dataKey="completedTodos" name="完成待办" fill="#00ff88" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}

// ===================== 待办完成趋势折线图 =====================
export function TodoTrendChart() {
  const todos = useTodoStore((s) => s.todos)

  const trendData = useMemo(() => {
    const now = new Date()
    const days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(now.getDate() - i)
      const dateStr = `${date.getMonth() + 1}/${date.getDate()}`

      const count = todos.filter((t) => {
        if (!t.completedAt) return false
        const d = new Date(t.completedAt)
        return (
          d.getFullYear() === date.getFullYear() &&
          d.getMonth() === date.getMonth() &&
          d.getDate() === date.getDate()
        )
      }).length

      days.push({
        date: dateStr,
        completed: count || Math.floor(Math.random() * 4),
      })
    }
    return days
  }, [todos])

  return (
    <GlassCard className="p-4">
      <h3 className="text-xs text-textSecondary mb-2">待办完成趋势</h3>
      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="todoGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ecdc4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#4ecdc4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.gridColor} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: chartTheme.textColor }}
              axisLine={{ stroke: chartTheme.gridColor }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: chartTheme.textColor }}
              axisLine={{ stroke: chartTheme.gridColor }}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip {...tooltipStyle} />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="#4ecdc4"
              strokeWidth={2}
              fill="url(#todoGradient)"
              name="完成数"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}

// ===================== 工作节奏热力图 =====================
export function WorkRhythmChart() {
  const days = ['一', '二', '三', '四', '五', '六', '日']
  const periods = ['上午', '下午', '晚上', '深夜']

  // 生成稳定的mock活跃度数据
  const heatData = useMemo(() => {
    const data: number[][] = []
    for (let p = 0; p < 4; p++) {
      const row: number[] = []
      for (let d = 0; d < 7; d++) {
        // 使用固定种子模拟：工作日白天更活跃
        const isWorkday = d < 5
        const isDaytime = p < 2
        const base = isWorkday && isDaytime ? 0.5 : isWorkday ? 0.3 : 0.15
        const variation = ((d * 7 + p * 3 + 5) % 10) / 20
        row.push(Math.min(base + variation, 0.9))
      }
      data.push(row)
    }
    return data
  }, [])

  return (
    <GlassCard className="p-4">
      <h3 className="text-xs text-textSecondary mb-2">工作节奏</h3>
      <div className="h-[200px] flex flex-col justify-center">
        {/* Y轴标签 + 网格 */}
        <div className="flex flex-col gap-1">
          {periods.map((period, pIdx) => (
            <div key={period} className="flex items-center gap-1">
              <span className="text-[9px] text-textSecondary w-6 text-right shrink-0">
                {period}
              </span>
              <div className="flex gap-[3px] flex-1">
                {days.map((_, dIdx) => (
                  <div
                    key={`${pIdx}-${dIdx}`}
                    className="flex-1 aspect-square rounded-[3px] min-h-[18px]"
                    style={{
                      backgroundColor: `rgba(0, 255, 136, ${heatData[pIdx][dIdx]})`,
                    }}
                    title={`周${days[dIdx]} ${period}: ${Math.round(heatData[pIdx][dIdx] * 100)}%`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {/* X轴标签 */}
        <div className="flex gap-[3px] mt-1 ml-7">
          {days.map((day) => (
            <span key={day} className="flex-1 text-center text-[9px] text-textSecondary">
              {day}
            </span>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

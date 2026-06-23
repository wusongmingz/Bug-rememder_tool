import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { useBugStore } from '@/stores/bugStore'

export default function BugTrend() {
  const trendData = useBugStore((s) => s.trendData)

  if (trendData.length === 0) {
    return (
      <div className="h-[120px] flex items-center justify-center text-xs text-textSecondary">
        暂无趋势数据
      </div>
    )
  }

  return (
    <div className="h-[120px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={trendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#8888aa' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#8888aa' }}
            axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(30,30,60,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
              color: '#e0e0e0',
            }}
            labelStyle={{ color: '#8888aa' }}
          />
          <Line
            type="monotone"
            dataKey="added"
            stroke="#ff6b35"
            strokeWidth={2}
            dot={false}
            name="新增"
          />
          <Line
            type="monotone"
            dataKey="resolved"
            stroke="#00ff88"
            strokeWidth={2}
            dot={false}
            name="解决"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

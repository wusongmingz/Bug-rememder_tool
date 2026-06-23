import { useBugStore, useBugCounts } from '@/stores/bugStore'
import { useZentao } from '@/hooks/useZentao'
import GlassCard from '@/components/Shared/GlassCard'
import PulseNumber from '@/components/Shared/PulseNumber'
import StatusDot from '@/components/Shared/StatusDot'
import BugTrend from './BugTrend'
import BugList from './BugList'
import PixelScene from '../PixelScene/PixelScene'

const severityConfig = [
  { key: 'fatal' as const, label: '致命', color: '#ff4444' },
  { key: 'critical' as const, label: '严重', color: '#ff6b35' },
  { key: 'normal' as const, label: '一般', color: '#ffd93d' },
  { key: 'suggestion' as const, label: '建议', color: '#4ecdc4' },
]

function getActiveColor(count: number): string {
  if (count <= 3) return '#00ff88'
  if (count <= 7) return '#ff6b35'
  return '#ff4444'
}

export default function BugDashboard() {
  const { connectionStatus, lastFetched } = useBugStore()
  const counts = useBugCounts()

  // 初始化禅道连接hook（会自动加载mock数据）
  useZentao()

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {/* 像素办公室动画场景 */}
      <GlassCard className="!p-0 overflow-hidden">
        <PixelScene />
      </GlassCard>

      {/* 标题行 */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-textPrimary">Bug 监控</h1>
        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-xs text-textSecondary">
              更新于 {lastFetched}
            </span>
          )}
          <StatusDot status={connectionStatus} />
        </div>
      </div>

      {/* 活跃Bug大数字 */}
      <GlassCard className="flex flex-col items-center py-6">
        <PulseNumber
          value={counts.total}
          color={getActiveColor(counts.total)}
          size="lg"
        />
        <span className="text-xs text-textSecondary mt-2">活跃 Bug 数量</span>
      </GlassCard>

      {/* 分类统计小卡片 */}
      <div className="grid grid-cols-4 gap-3">
        {severityConfig.map(({ key, label, color }) => (
          <GlassCard key={key} hoverable className="!p-3 flex flex-col items-center gap-1">
            <span className="text-lg font-bold" style={{ color }}>
              {counts[key]}
            </span>
            <span className="text-xs text-textSecondary">{label}</span>
          </GlassCard>
        ))}
      </div>

      {/* 趋势图 */}
      <GlassCard>
        <h3 className="text-sm text-textSecondary mb-2">7日趋势</h3>
        <BugTrend />
      </GlassCard>

      {/* Bug列表 */}
      <GlassCard>
        <h3 className="text-sm text-textSecondary mb-3">Bug 列表</h3>
        <BugList />
      </GlassCard>
    </div>
  )
}

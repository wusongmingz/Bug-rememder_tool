import { useState, useMemo } from 'react'
import { useBugStore } from '@/stores/bugStore'
import { Bug } from '@/types'

interface BugListPanelProps {
  selectedBugId: number | null
  onSelectBug: (id: number | null) => void
}

type SeverityFilter = 'all' | 'fatal' | 'critical' | 'normal' | 'suggestion'

const SEVERITY_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  fatal: { label: '紧急', icon: '⚠', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
  critical: { label: '重要', icon: '△', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
  normal: { label: '一般', icon: '●', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
  suggestion: { label: '提示', icon: '○', color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' },
}

const PAGE_SIZE = 6

function formatTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}天前`
  return `${date.getMonth() + 1}-${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function BugListPanel({ selectedBugId, onSelectBug }: BugListPanelProps) {
  const bugs = useBugStore((s) => s.bugs)
  const [filter, setFilter] = useState<SeverityFilter>('all')
  const [page, setPage] = useState(1)

  // 只显示活跃Bug
  const activeBugs = useMemo(() => bugs.filter((b) => b.status === 'active'), [bugs])

  // 统计各严重级别数量
  const counts = useMemo(() => ({
    all: activeBugs.length,
    fatal: activeBugs.filter((b) => b.severity === 'fatal').length,
    critical: activeBugs.filter((b) => b.severity === 'critical').length,
    normal: activeBugs.filter((b) => b.severity === 'normal').length,
    suggestion: activeBugs.filter((b) => b.severity === 'suggestion').length,
  }), [activeBugs])

  // 过滤后的Bug列表
  const filteredBugs = useMemo(() => {
    if (filter === 'all') return activeBugs
    return activeBugs.filter((b) => b.severity === filter)
  }, [activeBugs, filter])

  // 分页
  const totalPages = Math.max(1, Math.ceil(filteredBugs.length / PAGE_SIZE))
  const currentPage = Math.min(page, totalPages)
  const pagedBugs = filteredBugs.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // 切换过滤时重置页码
  const handleFilterChange = (f: SeverityFilter) => {
    setFilter(f)
    setPage(1)
  }

  const filters: { key: SeverityFilter; label: string; color: string; activeColor: string }[] = [
    { key: 'all', label: '全部', color: 'text-textSecondary', activeColor: 'text-[#00ff88] border-[#00ff88]/40 bg-[#00ff88]/10' },
    { key: 'fatal', label: '紧急', color: 'text-textSecondary', activeColor: 'text-red-400 border-red-500/40 bg-red-500/10' },
    { key: 'critical', label: '重要', color: 'text-textSecondary', activeColor: 'text-orange-400 border-orange-500/40 bg-orange-500/10' },
    { key: 'normal', label: '一般', color: 'text-textSecondary', activeColor: 'text-blue-400 border-blue-500/40 bg-blue-500/10' },
    { key: 'suggestion', label: '提示', color: 'text-textSecondary', activeColor: 'text-gray-400 border-gray-500/40 bg-gray-500/10' },
  ]

  return (
    <div className="h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <span className="text-sm font-medium text-textPrimary">Bug 列表</span>
      </div>

      {/* 过滤标签 */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 flex-shrink-0 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => handleFilterChange(f.key)}
            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
              filter === f.key
                ? f.activeColor
                : `${f.color} border-transparent hover:border-white/10`
            }`}
          >
            {f.label}({counts[f.key]})
          </button>
        ))}
      </div>

      {/* Bug列表 */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {pagedBugs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-textSecondary">
            暂无Bug数据
          </div>
        ) : (
          pagedBugs.map((bug) => (
            <BugListItem
              key={bug.id}
              bug={bug}
              isSelected={selectedBugId === bug.id}
              onClick={() => onSelectBug(bug.id)}
            />
          ))
        )}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 px-3 py-2 border-t border-white/5 flex-shrink-0">
          <button
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="text-xs px-1.5 py-0.5 text-textSecondary hover:text-textPrimary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &lt;
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`text-xs w-5 h-5 rounded ${
                p === currentPage
                  ? 'bg-[#00ff88]/20 text-[#00ff88]'
                  : 'text-textSecondary hover:text-textPrimary'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="text-xs px-1.5 py-0.5 text-textSecondary hover:text-textPrimary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            &gt;
          </button>
        </div>
      )}
    </div>
  )
}

function BugListItem({ bug, isSelected, onClick }: { bug: Bug; isSelected: boolean; onClick: () => void }) {
  const config = SEVERITY_CONFIG[bug.severity] || SEVERITY_CONFIG.normal

  return (
    <div
      onClick={onClick}
      className={`px-3 py-2 cursor-pointer transition-colors border-l-2 ${
        isSelected
          ? 'border-l-[#00ff88] bg-white/5'
          : 'border-l-transparent hover:bg-white/[0.02]'
      }`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-sm flex-shrink-0 ${config.color}`}>{config.icon}</span>
        <span className="text-xs text-textPrimary truncate flex-1">{bug.title}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${config.bg} ${config.color} ${config.border}`}>
          {config.label}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1 pl-5">
        <span className="text-[10px] text-textSecondary truncate">
          {bug.assignedToRealName || bug.assignedTo || '未指派'}
        </span>
        <span className="text-[10px] text-textSecondary/60 ml-auto flex-shrink-0">
          {formatTime(bug.createdDate)}
        </span>
      </div>
    </div>
  )
}

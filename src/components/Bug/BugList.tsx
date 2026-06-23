import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBugStore } from '@/stores/bugStore'
import { Bug } from '@/types'
import BugCard from './BugCard'

type SeverityFilter = 'all' | Bug['severity']
type StatusFilter = 'all' | 'active' | 'resolved'

export default function BugList() {
  const bugs = useBugStore((s) => s.bugs)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filteredBugs = useMemo(() => {
    return bugs.filter((bug) => {
      if (severityFilter !== 'all' && bug.severity !== severityFilter) return false
      if (statusFilter !== 'all' && bug.status !== statusFilter) return false
      return true
    })
  }, [bugs, severityFilter, statusFilter])

  return (
    <div className="flex flex-col gap-3">
      {/* 筛选栏 */}
      <div className="flex items-center gap-3">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as SeverityFilter)}
          className="bg-[rgba(30,30,60,0.8)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2.5 py-1.5 text-xs text-textPrimary outline-none focus:border-accent transition-colors"
        >
          <option value="all">全部严重程度</option>
          <option value="fatal">致命</option>
          <option value="critical">严重</option>
          <option value="normal">一般</option>
          <option value="suggestion">建议</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="bg-[rgba(30,30,60,0.8)] border border-[rgba(255,255,255,0.1)] rounded-lg px-2.5 py-1.5 text-xs text-textPrimary outline-none focus:border-accent transition-colors"
        >
          <option value="all">全部状态</option>
          <option value="active">活跃</option>
          <option value="resolved">已解决</option>
        </select>

        <span className="text-xs text-textSecondary ml-auto">
          共 {filteredBugs.length} 条
        </span>
      </div>

      {/* 列表区域 */}
      <div className="max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
        {filteredBugs.length === 0 ? (
          <div className="py-8 text-center text-sm text-textSecondary">
            暂无Bug数据
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredBugs.map((bug, index) => (
              <motion.div
                key={bug.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
                <BugCard bug={bug} />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

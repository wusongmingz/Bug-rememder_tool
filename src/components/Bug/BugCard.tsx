import { Bug } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

interface BugCardProps {
  bug: Bug
}

const severityColors: Record<Bug['severity'], string> = {
  fatal: '#ff4444',
  critical: '#ff6b35',
  normal: '#ffd93d',
  suggestion: '#4ecdc4',
}

export default function BugCard({ bug }: BugCardProps) {
  const relativeTime = formatDistanceToNow(new Date(bug.createdDate), {
    addSuffix: true,
    locale: zhCN,
  })

  return (
    <div className="group flex items-stretch gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)] cursor-default">
      {/* 左侧严重程度颜色条 */}
      <div
        className="w-[3px] rounded-full flex-shrink-0"
        style={{ backgroundColor: severityColors[bug.severity] }}
      />

      {/* 内容区域 */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        {/* 标题 */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-textPrimary truncate flex-1">
            {bug.title}
          </span>
          {/* 状态标签 */}
          <span
            className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
              bug.status === 'active'
                ? 'bg-[rgba(255,107,53,0.15)] text-warning'
                : 'bg-[rgba(0,255,136,0.15)] text-accent'
            }`}
          >
            {bug.status === 'active' ? '活跃' : '已解决'}
          </span>
        </div>

        {/* 底部行：指派人 + 创建时间 */}
        <div className="flex items-center gap-3 text-xs text-textSecondary">
          <span>{bug.assignedTo}</span>
          <span>{relativeTime}</span>
        </div>
      </div>
    </div>
  )
}

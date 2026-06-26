import { useBugStore } from '@/stores/bugStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { TeamMember } from '@/types'

interface CharacterStatCardProps {
  name: string
  bugCount: number
  isCurrentUser?: boolean
}

function getBugCountColor(count: number): string {
  if (count === 0) return '#00ff88'
  if (count <= 3) return '#ffffff'
  if (count <= 7) return '#ffaa00'
  return '#ff4444'
}

function CharacterStatCard({ name, bugCount, isCurrentUser }: CharacterStatCardProps) {
  return (
    <div
      className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg flex-shrink-0 ${
        isCurrentUser
          ? 'border border-[#00ff88]/50 bg-[#00ff88]/5'
          : 'border border-transparent'
      }`}
    >
      {/* 像素头像占位 */}
      <div className="w-[32px] h-[32px] rounded bg-[#1a1a2e] border border-white/10 flex items-center justify-center text-sm">
        👨‍💻
      </div>
      {/* 名称 */}
      <span className="text-[10px] text-textPrimary leading-tight whitespace-nowrap max-w-[56px] truncate">
        {name}
      </span>
      {/* Bug数量 */}
      <span className="text-[10px] leading-tight whitespace-nowrap" style={{ color: getBugCountColor(bugCount) }}>
        🐛 {bugCount}
      </span>
    </div>
  )
}

export default function CharacterStatsRow() {
  const teamMembers = useBugStore((s) => s.teamMembers)
  const selectedMembers = useSettingsStore((s) => s.selectedMembers)

  // 过滤逻辑
  let displayMembers: TeamMember[]

  if (selectedMembers.length === 0) {
    // 无选择时显示全部，最多10人
    displayMembers = teamMembers.slice(0, 10)
  } else {
    // 显示选中的人 + 当前用户（始终显示）
    displayMembers = teamMembers.filter((m) => {
      if (m.isCurrentUser) return true
      const id = m.account || m.name
      return selectedMembers.includes(id)
    })
  }

  // 无数据占位
  if (teamMembers.length === 0) {
    return (
      <div className="h-[60px] flex items-center justify-center w-full">
        <span className="text-xs text-textSecondary animate-pulse">等待连接...</span>
      </div>
    )
  }

  return (
    <div className="h-[60px] flex items-center w-full overflow-x-auto scrollbar-hide">
      <div className="flex items-center gap-3">
        {displayMembers.map((member) => (
          <CharacterStatCard
            key={member.account || member.name}
            name={member.name}
            bugCount={member.bugCount}
            isCurrentUser={member.isCurrentUser}
          />
        ))}
      </div>
    </div>
  )
}

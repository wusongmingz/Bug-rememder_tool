import { useState } from 'react'
import { useBugStore } from '@/stores/bugStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useZentao } from '@/hooks/useZentao'
import StatusDot from '@/components/Shared/StatusDot'
import PixelScene from '../PixelScene/PixelScene'

export default function BugDashboard() {
  const { connectionStatus, bugs, teamMembers } = useBugStore()
  const { selectedMembers, setSelectedMembers } = useSettingsStore()
  const activeBugCount = bugs.filter(b => b.status === 'active').length
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')

  useZentao()

  // 获取当前用户名称
  const currentUser = teamMembers.find(m => m.isCurrentUser)

  // 过滤同事列表（搜索 + 排除自己）
  const filteredMembers = teamMembers
    .filter(m => !m.isCurrentUser)
    .filter(m => {
      if (!memberSearch.trim()) return true
      const search = memberSearch.toLowerCase()
      return (
        m.name.toLowerCase().includes(search) ||
        (m.account && m.account.toLowerCase().includes(search))
      )
    })

  return (
    <div className="h-full flex flex-col p-3">
      {/* 顶部简洁信息栏 */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-textPrimary">Bug 监控</span>
          <StatusDot status={connectionStatus} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: activeBugCount <= 3 ? '#00ff88' : activeBugCount <= 7 ? '#ff6b35' : '#ff4444' }}>
            {activeBugCount} 个活跃Bug
          </span>
          {/* 同事选择按钮 */}
          <div className="relative">
            <button
              onClick={() => setShowMemberPicker(!showMemberPicker)}
              className="text-xs text-textSecondary hover:text-[#00ff88] transition-colors"
            >
              👥 选择同事{selectedMembers.length > 0 && ` (${selectedMembers.length})`}
            </button>
            {/* 展开后显示checkbox列表 */}
            {showMemberPicker && (
              <div className="absolute top-7 right-0 z-50 bg-[#1a1a2e] border border-white/10 rounded-lg p-3 shadow-xl w-[240px]">
                <div className="text-xs text-textSecondary mb-2">
                  选择要显示的同事（已选 {selectedMembers.length} 人）
                </div>

                {/* 当前用户始终显示提示 */}
                {currentUser && (
                  <div className="text-[10px] text-[#00ff88] mb-1">✓ 你（{currentUser.name}）始终显示</div>
                )}

                {/* 搜索框 */}
                <input
                  type="text"
                  value={memberSearch}
                  onChange={e => setMemberSearch(e.target.value)}
                  placeholder="搜索同事..."
                  className="w-full text-xs bg-black/30 border border-white/10 rounded px-2 py-1.5 text-textPrimary placeholder-textSecondary/50 mb-2 outline-none focus:border-[#00ff88]/50"
                />

                {/* 全选/全不选 */}
                <div className="flex gap-2 mb-2">
                  <button
                    onClick={() => setSelectedMembers(teamMembers.filter(m => !m.isCurrentUser).map(m => m.account || m.name))}
                    className="text-[10px] text-[#00ff88] hover:underline"
                  >
                    全选
                  </button>
                  <button
                    onClick={() => setSelectedMembers([])}
                    className="text-[10px] text-textSecondary hover:underline"
                  >
                    全不选
                  </button>
                </div>

                {teamMembers.length === 0 && (
                  <div className="text-xs text-textSecondary/60">连接禅道后可选择</div>
                )}

                {/* 同事列表 - 可滚动，不限制数量 */}
                <div className="max-h-[300px] overflow-y-auto space-y-0.5">
                  {filteredMembers.map(member => {
                    const id = member.account || member.name
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-2 text-xs text-textPrimary py-1 cursor-pointer hover:bg-white/5 px-1.5 rounded"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMembers([...selectedMembers, id])
                            } else {
                              setSelectedMembers(selectedMembers.filter(m => m !== id))
                            }
                          }}
                          className="accent-[#00ff88] flex-shrink-0"
                        />
                        <span className="truncate">{member.name}</span>
                        {member.bugCount > 0 && (
                          <span className="text-[#ff6b35] flex-shrink-0 ml-auto">({member.bugCount})</span>
                        )}
                      </label>
                    )
                  })}
                  {filteredMembers.length === 0 && teamMembers.length > 0 && (
                    <div className="text-xs text-textSecondary text-center py-2">无匹配结果</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 像素办公室 - 占据几乎全部空间 */}
      <div className="flex-1 rounded-xl overflow-hidden border border-white/5 bg-[rgba(30,30,60,0.4)]">
        <PixelScene />
      </div>
    </div>
  )
}

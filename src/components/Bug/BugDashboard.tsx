import { useState } from 'react'
import { useBugStore } from '@/stores/bugStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useAchievementStore } from '@/stores/achievementStore'
import { useZentao } from '@/hooks/useZentao'
import StatusDot from '@/components/Shared/StatusDot'
import WindowControls from '@/components/Layout/WindowControls'
import PixelScene from '../PixelScene/PixelScene'
import BugListPanel from './BugListPanel'
import BugDetailPanel from './BugDetailPanel'

export default function BugDashboard() {
  const { connectionStatus, bugs, teamMembers } = useBugStore()
  const { selectedMembers, setSelectedMembers } = useSettingsStore()
  const achievements = useAchievementStore(state => state.achievements)
  const activeBugCount = bugs.filter(b => b.status === 'active').length
  const [showMemberPicker, setShowMemberPicker] = useState(false)
  const [showAchievements, setShowAchievements] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedBugId, setSelectedBugId] = useState<number | null>(null)
  const unlockedCount = achievements.filter(a => a.unlocked).length

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
    <div className="h-full flex flex-col">
      {/* 顶部简洁信息栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-textPrimary">Bug 监控</span>
          <StatusDot status={connectionStatus} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold" style={{ color: activeBugCount <= 3 ? '#00ff88' : activeBugCount <= 7 ? '#ff6b35' : '#ff4444' }}>
            {activeBugCount} 个活跃Bug
          </span>
          {/* 成就按钮 */}
          <div className="relative">
            <button
              className="relative text-sm hover:scale-110 transition-transform"
              onClick={() => { setShowAchievements(!showAchievements); setShowMemberPicker(false) }}
            >
              🏆
              {unlockedCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-yellow-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {unlockedCount}
                </span>
              )}
            </button>
            {showAchievements && (
              <div className="absolute top-7 right-0 bg-[#1a1a2e] border border-white/10 rounded-lg p-3 w-64 z-50 shadow-xl">
                <div className="text-sm font-bold text-yellow-400 mb-2">🏆 成就</div>
                {achievements.map(a => (
                  <div key={a.id} className="flex items-center gap-2 py-1 text-xs">
                    <span className="text-base">{a.unlocked ? a.icon : '❓'}</span>
                    <div className="flex-1 min-w-0">
                      <div className={a.unlocked ? 'text-white' : 'text-gray-500'}>
                        {a.unlocked ? a.name : '???'}
                      </div>
                      {a.unlocked ? (
                        <div className="text-gray-400 truncate">{a.description}</div>
                      ) : a.target ? (
                        <div className="w-full bg-gray-700 rounded-full h-1.5 mt-0.5">
                          <div className="bg-yellow-500 h-1.5 rounded-full" style={{ width: `${((a.progress || 0) / a.target) * 100}%` }} />
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {/* 同事选择按钮 */}
          <div className="relative">
            <button
              onClick={() => { setShowMemberPicker(!showMemberPicker); setShowAchievements(false) }}
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
          {/* 窗口控制按钮 */}
          <WindowControls />
        </div>
      </div>

      {/* 上半部：像素办公室场景 */}
      <div className="h-[50%] min-h-[200px] rounded-xl overflow-hidden border border-white/5 bg-[rgba(30,30,60,0.4)] mx-2">
        <PixelScene />
      </div>

      {/* 下半部：Bug面板区域 - 左右分栏 */}
      <div className="flex-1 flex gap-2 px-2 pb-2 min-h-0">
        {/* 左侧：Bug列表 */}
        <div className="w-[45%] rounded-xl bg-[rgba(30,30,60,0.6)] backdrop-blur-md border border-white/5 overflow-hidden">
          <BugListPanel selectedBugId={selectedBugId} onSelectBug={setSelectedBugId} />
        </div>
        {/* 右侧：Bug详情 */}
        <div className="flex-1 rounded-xl bg-[rgba(30,30,60,0.6)] backdrop-blur-md border border-white/5 overflow-hidden">
          <BugDetailPanel bugId={selectedBugId} onClose={() => setSelectedBugId(null)} />
        </div>
      </div>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
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

  // 点击外部关闭面板的ref
  const achievementRef = useRef<HTMLDivElement>(null)
  const memberPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (showAchievements && achievementRef.current && !achievementRef.current.contains(e.target as Node)) {
        setShowAchievements(false)
      }
      if (showMemberPicker && memberPickerRef.current && !memberPickerRef.current.contains(e.target as Node)) {
        setShowMemberPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAchievements, showMemberPicker])

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
          {/* 成就按钮 - 点击展开/收起 */}
          <div className="relative" ref={achievementRef}>
            <button
              className="relative px-2 py-1 rounded hover:bg-white/10 transition-colors"
              onClick={() => setShowAchievements(!showAchievements)}
            >
              <span className="text-sm">🏆</span> <span className="text-xs text-gray-400">{unlockedCount}/{achievements.length}</span>
            </button>
            {showAchievements && (
              <div className="absolute top-9 right-0 bg-[#1a1a2e] border border-white/10 rounded-lg p-3 w-72 z-50 shadow-xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-yellow-400">🏆 成就 {unlockedCount}/{achievements.length}</span>
                  <button
                    onClick={() => setShowAchievements(false)}
                    className="w-6 h-6 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
                  {achievements.map(a => (
                    <div key={a.id} className={`rounded p-1.5 ${a.unlocked ? 'bg-yellow-900/30 border border-yellow-600/50' : 'bg-gray-700/50 border border-gray-600/30'}`}>
                      <div className="flex items-center gap-1">
                        <span>{a.icon}</span>
                        <span className={`text-xs ${a.unlocked ? 'text-yellow-300' : 'text-gray-400'}`}>{a.name}</span>
                        {a.unlocked && <span className="text-yellow-500 text-xs">✓</span>}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5">{a.description}</div>
                      {a.target && !a.unlocked && (
                        <div className="w-full bg-gray-700 rounded-full h-1 mt-1">
                          <div className="bg-yellow-500 h-1 rounded-full" style={{ width: `${Math.min(((a.progress || 0) / a.target) * 100, 100)}%` }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* 同事选择按钮 */}
          <div className="relative" ref={memberPickerRef}>
            <button
              onClick={() => setShowMemberPicker(!showMemberPicker)}
              className="px-3 py-1.5 text-xs text-textSecondary hover:text-[#00ff88] hover:bg-white/10 rounded transition-colors"
            >
              👥 选择同事{selectedMembers.length > 0 && ` (${selectedMembers.length})`}
            </button>
            {/* 展开后显示checkbox列表 */}
            {showMemberPicker && (
              <div className="absolute top-10 right-0 z-50 bg-[#1a1a2e] border border-white/10 rounded-lg shadow-xl w-[260px] p-3 flex flex-col max-h-[400px]">
                {/* 头部：标题 + 关闭按钮 */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-white">选择同事</span>
                  <button
                    onClick={() => setShowMemberPicker(false)}
                    className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-400 hover:bg-red-500/20 transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {/* 当前用户始终显示提示 */}
                {currentUser && (
                  <div className="text-xs text-[#00ff88] mb-2">✓ 你（{currentUser.name}）始终显示</div>
                )}

                {/* 搜索框 */}
                <div className="relative mb-2">
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={e => setMemberSearch(e.target.value)}
                    placeholder="搜索同事..."
                    className="w-full px-3 py-2 text-sm bg-black/30 border border-white/10 rounded-md text-textPrimary placeholder-textSecondary/50 outline-none focus:border-[#00ff88]/50"
                  />
                  {memberSearch && (
                    <button
                      onClick={() => setMemberSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* 快捷操作栏 */}
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setSelectedMembers(teamMembers.filter(m => !m.isCurrentUser).map(m => m.account || m.name))}
                    className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
                  >
                    全选
                  </button>
                  <button
                    onClick={() => setSelectedMembers([])}
                    className="px-3 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                  >
                    全不选
                  </button>
                  <span className="text-xs text-gray-400 ml-auto">
                    已选 {selectedMembers.length} 人
                  </span>
                </div>

                {teamMembers.length === 0 && (
                  <div className="text-xs text-textSecondary/60 py-2">连接禅道后可选择</div>
                )}

                {/* 同事列表 - 可滚动 */}
                <div className="flex-1 overflow-y-auto space-y-0.5">
                  {filteredMembers.map(member => {
                    const id = member.account || member.name
                    return (
                      <label
                        key={id}
                        className="flex items-center gap-2 text-sm text-textPrimary py-1.5 cursor-pointer hover:bg-white/5 px-2 rounded"
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
                          className="w-4 h-4 accent-[#00ff88] flex-shrink-0 rounded"
                        />
                        <span className="truncate flex-1">{member.name}</span>
                        {member.bugCount > 0 && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded flex-shrink-0">
                            {member.bugCount} Bug
                          </span>
                        )}
                      </label>
                    )
                  })}
                  {filteredMembers.length === 0 && teamMembers.length > 0 && (
                    <div className="text-xs text-textSecondary text-center py-2">无匹配结果</div>
                  )}
                </div>

                {/* 底部确认 */}
                <div className="mt-2 pt-2 border-t border-white/10 flex justify-end">
                  <button
                    onClick={() => setShowMemberPicker(false)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors"
                  >
                    确定
                  </button>
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

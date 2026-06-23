import { useRef, useEffect, useCallback, useState } from 'react'
import { useBugStore } from '../../stores/bugStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { PixelAnimator, getStateFromBugCount, TeamMemberData } from './animator'
import { TeamMember } from '../../types'

interface LabelPosition {
  x: number
  y: number
  name: string
  bugCount: number
  isCurrentUser?: boolean
}

export default function PixelScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animatorRef = useRef<PixelAnimator | null>(null)
  const labelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const bugs = useBugStore(state => state.bugs)
  const connectionStatus = useBugStore(state => state.connectionStatus)
  const teamMembers = useBugStore(state => state.teamMembers)
  const selectedMembers = useSettingsStore(state => state.selectedMembers)
  const activeBugCount = bugs.filter(b => b.status === 'active').length
  const prevTeamMembersRef = useRef<TeamMember[]>([])
  const isInitialLoadRef = useRef(true)

  const [labelPositions, setLabelPositions] = useState<LabelPosition[]>([])

  // 根据 selectedMembers 过滤显示的成员（始终保留当前用户）
  const getDisplayMembers = useCallback((): TeamMember[] => {
    if (teamMembers.length === 0) return []
    if (selectedMembers.length === 0) {
      // 用户还没选，显示全部（或bug最多的10人）
      return teamMembers.slice(0, 10)
    }
    // 显示用户勾选的同事 + 始终保留当前用户
    return teamMembers.filter(m =>
      m.isCurrentUser || selectedMembers.includes(m.account || m.name)
    ).slice(0, 10)
  }, [teamMembers, selectedMembers])

  // 定时从 animator获取标签位置
  const updateLabelPositions = useCallback(() => {
    const animator = animatorRef.current
    if (!animator) return
    const members = animator.getDisplayMembers()
    const positions: LabelPosition[] = []
    for (let i = 0; i < members.length; i++) {
      const pos = animator.getMemberLabelPosition(i)
      if (pos) {
        positions.push({ x: pos.x, y: pos.y, name: members[i].name, bugCount: members[i].bugCount, isCurrentUser: members[i].isCurrentUser })
      }
    }
    setLabelPositions(positions)
  }, [])

  // 初始化 Canvas 和动画器
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const animator = new PixelAnimator(canvas)
    animatorRef.current = animator
    animator.start()

    // 如果 store 中已有数据，立即设置给 animator
    const currentMembers = useBugStore.getState().teamMembers
    if (currentMembers.length > 0) {
      const displayMembers = getDisplayMembers()
      const memberData: TeamMemberData[] = displayMembers.map(m => ({
        name: m.name,
        bugCount: m.bugCount,
        isCurrentUser: m.isCurrentUser || false,
      }))
      animator.setTeamMembers(memberData)
      // 延迟更新标签位置（等 animator 计算完）
      setTimeout(updateLabelPositions, 100)
    }

    // 定时更新标签位置（跟随动画帧率）
    labelTimerRef.current = setInterval(updateLabelPositions, 500)

    return () => {
      animator.destroy()
      animatorRef.current = null
      if (labelTimerRef.current) {
        clearInterval(labelTimerRef.current)
        labelTimerRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 当团队成员数据或勾选变化时更新动画器
  useEffect(() => {
    if (!animatorRef.current) return
    const displayMembers = getDisplayMembers()
    if (displayMembers.length > 0) {
      // 获取当前用户名，标记isCurrentUser
      const api = (window as unknown as { electronAPI?: { storeGet?: (key: string) => Promise<unknown> } }).electronAPI
      const setMembers = (currentUsername: string) => {
        const memberData: TeamMemberData[] = displayMembers.map(m => ({
          name: m.name,
          bugCount: m.bugCount,
          isCurrentUser: !!(currentUsername && (m.name === currentUsername || m.account === currentUsername)),
        }))
        animatorRef.current?.setTeamMembers(memberData)
        // 立即更新一次 + 延迟再更新一次（等 animator 计算完位置）
        updateLabelPositions()
        setTimeout(updateLabelPositions, 100)
      }
      if (api?.storeGet) {
        api.storeGet('username').then((val) => {
          setMembers((val as string) || '')
        }).catch(() => setMembers(''))
      } else {
        setMembers('')
      }
    } else {
      // 清空显示
      animatorRef.current?.setTeamMembers([])
      updateLabelPositions()
    }
  }, [teamMembers, selectedMembers, getDisplayMembers, updateLabelPositions])

  // 当Bug数量变化时更新角色状态（真实数据模式）
  useEffect(() => {
    if (!animatorRef.current) return
    const newState = getStateFromBugCount(activeBugCount)
    animatorRef.current.setState(newState)
  }, [activeBugCount])

  // 检测团队成员的bug数增加触发老板动画
  useEffect(() => {
    if (!animatorRef.current) return
    if (teamMembers.length === 0) return

    // 跳过首次加载（避免初始数据触发）
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      prevTeamMembersRef.current = [...teamMembers]
      return
    }

    // 对比上次的 teamMembers 和这次的
    // 找出哪些人的 bugCount 增加了
    const prevMembers = prevTeamMembersRef.current
    if (prevMembers.length > 0) {
      const displayMembers = getDisplayMembers()
      const increased = displayMembers.filter(m => {
        const prev = prevMembers.find(pm => (pm.account || pm.name) === (m.account || m.name))
        return prev && m.bugCount > prev.bugCount
      })
      if (increased.length > 0) {
        // 触发老板动画，目标是bug增加最多的那个人
        const target = increased.sort((a, b) => {
          const prevA = prevMembers.find(pm => (pm.account || pm.name) === (a.account || a.name))
          const prevB = prevMembers.find(pm => (pm.account || pm.name) === (b.account || b.name))
          const deltaA = a.bugCount - (prevA?.bugCount || 0)
          const deltaB = b.bugCount - (prevB?.bugCount || 0)
          return deltaB - deltaA
        })[0]
        console.log('[PixelScene] 检测到成员bug增加, 触发老板动画, 目标:', target.name)
        animatorRef.current.triggerBoss(target.name)

        // 发送系统通知
        if (window.electronAPI?.zentaoShowBugNotification) {
          const prevMember = prevMembers.find(pm =>
            (pm.account || pm.name) === (target.account || target.name)
          )
          const newBugs = target.bugs.filter(b =>
            !prevMember?.bugs.some(pb => String(pb.id) === String(b.id))
          )

          if (newBugs.length > 0) {
            const newBug = newBugs[0]
            window.electronAPI.zentaoShowBugNotification({
              title: `🐛 新Bug: ${newBug.title}`,
              body: `指派给: ${target.name} | 严重程度: ${newBug.severity || '未知'}`,
              bugId: newBug.id,
            })
          } else {
            window.electronAPI.zentaoShowBugNotification({
              title: `🐛 ${target.name} 有新Bug`,
              body: `当前活跃Bug数: ${target.bugCount}`,
              bugId: null,
            })
          }
        }
      }
    }

    prevTeamMembersRef.current = [...teamMembers]
  }, [teamMembers, getDisplayMembers])

  return (
    <div className="relative w-full h-full">
      {/* Canvas像素场景 - 始终渲染以确保 animator 正确初始化 */}
      <canvas
        ref={canvasRef}
        width={700}
        height={350}
        className="w-full h-full"
        style={{ imageRendering: 'pixelated' }}
      />

      {/* 没有数据时显示等待界面（覆盖在canvas上方） */}
      {teamMembers.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a1a2e]/90 z-10">
          <div className="text-4xl mb-4">🏢</div>
          <div className="text-sm text-textSecondary">
            {connectionStatus === 'online' ? '加载中...' : '等待连接禅道...'}
          </div>
          <div className="text-xs text-textSecondary mt-2 opacity-60">
            请在设置中配置禅道连接
          </div>
        </div>
      )}

      {/* HTML名字标签覆盖层 */}
      {teamMembers.length > 0 && (
        <div className="absolute inset-0 pointer-events-none">
          {labelPositions.map((label) => (
            <div
              key={label.name}
              className="absolute flex items-center gap-1"
              style={{
                left: `${(label.x / 700) * 100}%`,
                top: `${(label.y / 350) * 100}%`,
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              {label.isCurrentUser && (
                <span className="text-[#00ff88] text-[8px]">▼</span>
              )}
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                label.isCurrentUser
                  ? 'text-[#00ff88] bg-[#00ff88]/20 border border-[#00ff88]/40'
                  : 'text-white bg-black/60'
              }`}>
                {label.name}
              </span>
              {label.bugCount > 0 && (
                <span
                  className="text-[9px] font-bold px-1 py-0.5 rounded"
                  style={{
                    backgroundColor: label.bugCount <= 3 ? 'rgba(0,200,100,0.3)' : label.bugCount <= 7 ? 'rgba(255,107,53,0.3)' : 'rgba(255,50,50,0.4)',
                    color: label.bugCount <= 3 ? '#00ff88' : label.bugCount <= 7 ? '#ff6b35' : '#ff4444',
                  }}
                >
                  {label.bugCount}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

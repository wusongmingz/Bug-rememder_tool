import { useRef, useEffect, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useBugStore } from '../../stores/bugStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { useAchievementStore } from '../../stores/achievementStore'
import { PixelAnimator, getStateFromBugCount, TeamMemberData, SpeechBubbleData } from './animator'
// import { initSprites } from './spriteLoader' // 禁用精灵图
import { TeamMember } from '../../types'

// === Speech Bubble Types ===
interface SpeechBubble {
  id: string
  targetName: string
  text: string
  type: 'bug' | 'status' | 'system' | 'chat'
  createdAt: number
  duration: number
}

const BUBBLE_TEXTS = {
  bug: ['又有Bug了...', '这Bug怎么回事', '又来活了...', '有新的Bug提醒！'],
  status: ['搞定！', '终于修好了', '这代码真优雅！', 'LGTM!'],
  system: ['需要咖啡续命...', '快下班了...', '让我想想...', '服务器内存告警！'],
  chat: ['今天加班吗？', '代码改变世界', '测试环境发现3个Bug', '需求又变了...'],
}

const BUBBLE_TEXT_COLORS: Record<SpeechBubble['type'], string> = {
  bug: 'text-red-400',
  status: 'text-[#00ff88]',
  system: 'text-yellow-400',
  chat: 'text-white',
}

const MAX_BUBBLES = 3

let bubbleIdCounter = 0
function nextBubbleId(): string {
  bubbleIdCounter++
  return `bubble_${bubbleIdCounter}_${Date.now()}`
}

// === Label Position Interface ===
interface LabelPosition {
  x: number
  y: number
  name: string
  bugCount: number
  isCurrentUser?: boolean
}

// === Context Menu Interface ===
interface ContextMenuState {
  x: number
  y: number
  memberIndex: number
  memberName: string
}

export default function PixelScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animatorRef = useRef<PixelAnimator | null>(null)
  const labelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bubbleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bubbleCleanupRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const canvasBubbleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const bugs = useBugStore(state => state.bugs)
  const connectionStatus = useBugStore(state => state.connectionStatus)
  const teamMembers = useBugStore(state => state.teamMembers)
  const selectedMembers = useSettingsStore(state => state.selectedMembers)
  const activeBugCount = bugs.filter(b => b.status === 'active').length
  const prevTeamMembersRef = useRef<TeamMember[]>([])
  const isInitialLoadRef = useRef(true)

  const [labelPositions, setLabelPositions] = useState<LabelPosition[]>([])
  const [bubbles, setBubbles] = useState<SpeechBubble[]>([])
  const [canvasBubbles, setCanvasBubbles] = useState<SpeechBubbleData[]>([])
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number }>({ width: 700, height: 350 })

  // Achievement store
  const incrementWhipCount = useAchievementStore(state => state.incrementWhipCount)
  const incrementCatPet = useAchievementStore(state => state.incrementCatPet)
  const addUsageMinute = useAchievementStore(state => state.addUsageMinute)
  const updateZeroBugTime = useAchievementStore(state => state.updateZeroBugTime)
  const checkAndUnlock = useAchievementStore(state => state.checkAndUnlock)

  // === Bubble Management ===
  const addBubble = useCallback((targetName: string, type: SpeechBubble['type'], text?: string) => {
    const texts = BUBBLE_TEXTS[type]
    const bubbleText = text || texts[Math.floor(Math.random() * texts.length)]
    const duration = 3000 + Math.random() * 2000 // 3-5 seconds

    setBubbles(prev => {
      // Limit max bubbles
      const updated = prev.length >= MAX_BUBBLES ? prev.slice(1) : [...prev]
      updated.push({
        id: nextBubbleId(),
        targetName,
        text: bubbleText,
        type,
        createdAt: Date.now(),
        duration,
      })
      return updated
    })
  }, [])

  // 根据 selectedMembers 过滤显示的成员（始终保留当前用户）
  const getDisplayMembers = useCallback((): TeamMember[] => {
    if (teamMembers.length === 0) return []
    if (selectedMembers.length === 0) {
      // 全不选时只显示当前用户
      return teamMembers.filter(m => m.isCurrentUser).slice(0, 20)
    }
    return teamMembers.filter(m =>
      m.isCurrentUser || selectedMembers.includes(m.account || m.name)
    ).slice(0, 20)
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
    // Update canvas size from animator
    const size = animator.getCanvasSize()
    setCanvasSize(prev => (prev.width === size.width && prev.height === size.height) ? prev : size)
  }, [])

  // 禁用精灵图，使用增强版程序化渲染
  // useEffect(() => {
  //   initSprites()
  // }, [])

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
      setTimeout(updateLabelPositions, 100)
    }

    // 定时更新标签位置
    labelTimerRef.current = setInterval(updateLabelPositions, 500)

    // 定时更新canvas气泡（~6次/秒，足够流畅且不浪费性能）
    canvasBubbleTimerRef.current = setInterval(() => {
      const anim = animatorRef.current
      if (!anim) return
      const newBubbles = anim.getActiveBubbles()
      setCanvasBubbles(prev => {
        if (prev.length === 0 && newBubbles.length === 0) return prev
        return [...newBubbles]
      })
    }, 160)

    return () => {
      animator.destroy()
      animatorRef.current = null
      if (labelTimerRef.current) {
        clearInterval(labelTimerRef.current)
        labelTimerRef.current = null
      }
      if (canvasBubbleTimerRef.current) {
        clearInterval(canvasBubbleTimerRef.current)
        canvasBubbleTimerRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // === 气泡定时器：随机chat气泡 + 过期清理 ===
  useEffect(() => {
    // 随机触发 chat 气泡（30-60秒间隔）
    const scheduleNextChat = () => {
      const delay = 30000 + Math.random() * 30000
      bubbleTimerRef.current = setTimeout(() => {
        const displayMembers = getDisplayMembers()
        if (displayMembers.length > 0) {
          const randomMember = displayMembers[Math.floor(Math.random() * displayMembers.length)]
          addBubble(randomMember.name, 'chat')
        }
        scheduleNextChat()
      }, delay)
    }
    scheduleNextChat()

    // 定期清理过期气泡
    bubbleCleanupRef.current = setInterval(() => {
      const now = Date.now()
      setBubbles(prev => prev.filter(b => now - b.createdAt < b.duration))
    }, 500)

    return () => {
      if (bubbleTimerRef.current) {
        clearTimeout(bubbleTimerRef.current)
        bubbleTimerRef.current = null
      }
      if (bubbleCleanupRef.current) {
        clearInterval(bubbleCleanupRef.current)
        bubbleCleanupRef.current = null
      }
    }
  }, [getDisplayMembers, addBubble])

  // 当团队成员数据或勾选变化时更新动画器
  useEffect(() => {
    if (!animatorRef.current) return
    const displayMembers = getDisplayMembers()
    if (displayMembers.length > 0) {
      const api = (window as unknown as { electronAPI?: { storeGet?: (key: string) => Promise<unknown> } }).electronAPI
      const setMembers = (currentUsername: string) => {
        const memberData: TeamMemberData[] = displayMembers.map(m => ({
          name: m.name,
          bugCount: m.bugCount,
          isCurrentUser: !!(currentUsername && (m.name === currentUsername || m.account === currentUsername)),
        }))
        animatorRef.current?.setTeamMembers(memberData)
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
      animatorRef.current?.setTeamMembers([])
      updateLabelPositions()
    }
  }, [teamMembers, selectedMembers, getDisplayMembers, updateLabelPositions])

  // 当Bug数量变化时更新角色状态
  useEffect(() => {
    if (!animatorRef.current) return
    const newState = getStateFromBugCount(activeBugCount)
    animatorRef.current.setState(newState)
  }, [activeBugCount])

  // === Canvas点击事件：点击同事弹出操作菜单，点击猫撸猫 ===
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || !animatorRef.current) return

    const rect = canvasRef.current.getBoundingClientRect()
    // 将页面坐标转换为canvas逻辑坐标
    const scaleX = canvasSize.width / rect.width
    const scaleY = canvasSize.height / rect.height
    const canvasX = (e.clientX - rect.left) * scaleX
    const canvasY = (e.clientY - rect.top) * scaleY

    // 检测是否点击了猫
    const catPos = animatorRef.current.getCatPosition()
    if (catPos && Math.abs(canvasX - catPos.x) < 15 && Math.abs(canvasY - catPos.y) < 15) {
      animatorRef.current.triggerPetCat()
      incrementCatPet()
      setContextMenu(null)
      return
    }

    // 让animator检测点击了哪个成员
    const clickedMemberIndex = animatorRef.current.getMemberAtPosition(canvasX, canvasY)
    if (clickedMemberIndex >= 0) {
      const displayMembers = getDisplayMembers()
      // 弹出菜单而不是直接抽打
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        memberIndex: clickedMemberIndex,
        memberName: displayMembers[clickedMemberIndex]?.name || '同事'
      })
    } else {
      setContextMenu(null) // 点击空白处关闭菜单
    }
  }, [getDisplayMembers, incrementCatPet, canvasSize])

  // 检测团队成员的bug数增加触发老板动画 + 气泡 + 特效
  useEffect(() => {
    if (!animatorRef.current) return
    if (teamMembers.length === 0) return

    // 跳过首次加载
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      prevTeamMembersRef.current = [...teamMembers]
      return
    }

    const prevMembers = prevTeamMembersRef.current
    if (prevMembers.length > 0) {
      const displayMembers = getDisplayMembers()

      // 检测bug增加的成员
      const increased = displayMembers.filter(m => {
        const prev = prevMembers.find(pm => (pm.account || pm.name) === (m.account || m.name))
        return prev && m.bugCount > prev.bugCount
      })

      // 检测bug减少的成员（修复了bug）
      const decreased = displayMembers.filter(m => {
        const prev = prevMembers.find(pm => (pm.account || pm.name) === (m.account || m.name))
        return prev && m.bugCount < prev.bugCount
      })

      if (increased.length > 0) {
        const target = increased.sort((a, b) => {
          const prevA = prevMembers.find(pm => (pm.account || pm.name) === (a.account || a.name))
          const prevB = prevMembers.find(pm => (pm.account || pm.name) === (b.account || b.name))
          const deltaA = a.bugCount - (prevA?.bugCount || 0)
          const deltaB = b.bugCount - (prevB?.bugCount || 0)
          return deltaB - deltaA
        })[0]

        console.log('[PixelScene] 检测到成员bug增加, 触发老板动画, 目标:', target.name)
        animatorRef.current.triggerBoss(target.name)

        // 对每个bug增加的成员，触发指派动画
        increased.forEach(member => {
          const prevMember = prevMembers.find(pm => (pm.account || pm.name) === (member.account || member.name))
          if (prevMember) {
            // 找出新指派的bug
            const newBugs = member.bugs.filter(b =>
              !prevMember.bugs.some(pb => String(pb.id) === String(b.id))
            )
            if (newBugs.length > 0) {
              // 触发 assign 动画（文件飘落效果）
              animatorRef.current!.triggerEffectAtMember('assign', member.name)
            }
          }
          // 触发 bugAppear 特效
          animatorRef.current!.triggerEffectAtMember('bugAppear', member.name)
          // 触发 bug 气泡
          addBubble(member.name, 'bug')
        })

        // 发送系统通知（仅当登录用户自己有新Bug时才弹出提醒）
        const currentUser = increased.find(m => m.isCurrentUser)
        if (currentUser && window.electronAPI?.zentaoShowBugNotification) {
          const prevMember = prevMembers.find(pm =>
            (pm.account || pm.name) === (currentUser.account || currentUser.name)
          )
          const newBugs = currentUser.bugs.filter(b =>
            !prevMember?.bugs.some(pb => String(pb.id) === String(b.id))
          )

          if (newBugs.length > 0) {
            const newBug = newBugs[0]
            window.electronAPI.zentaoShowBugNotification({
              title: `🐛 新Bug: ${newBug.title}`,
              body: `指派给: ${currentUser.name} | 严重程度: ${newBug.severity || '未知'}`,
              bugId: newBug.id,
            })
          } else {
            window.electronAPI.zentaoShowBugNotification({
              title: `🐛 ${currentUser.name} 有新Bug`,
              body: `当前活跃Bug数: ${currentUser.bugCount}`,
              bugId: null,
            })
          }
        }
      }

      // Bug修复 → 显示 status 气泡
      if (decreased.length > 0) {
        const fixer = decreased[0]
        addBubble(fixer.name, 'status')
        animatorRef.current.triggerEffectAtMember('complete', fixer.name)
      }
    }

    prevTeamMembersRef.current = [...teamMembers]
  }, [teamMembers, getDisplayMembers, addBubble])

  // === 成就检查定时器：每分钟检查一次 ===
  useEffect(() => {
    const interval = setInterval(() => {
      addUsageMinute()
      const hasActiveBugs = teamMembers.some(m => m.bugCount > 0)
      updateZeroBugTime(hasActiveBugs)
      const newAchievement = checkAndUnlock()
      if (newAchievement && animatorRef.current) {
        animatorRef.current.triggerAchievementUnlock(newAchievement.name)
      }
    }, 60000)
    return () => clearInterval(interval)
  }, [teamMembers, addUsageMinute, updateZeroBugTime, checkAndUnlock])

  return (
    <div className="relative w-full h-full">
      {/* Canvas像素场景 */}
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        className="w-full h-full"
        onClick={handleCanvasClick}
        style={{ cursor: 'pointer', imageRendering: 'pixelated' }}
      />

      {/* 右键菜单（点击同事后弹出） */}
      {contextMenu && (
        <>
          {/* 点击外部关闭遮罩 */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50 py-1.5 min-w-[150px]"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-700">
              {contextMenu.memberName}
            </div>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-red-400 transition-colors"
              onClick={() => {
                animatorRef.current?.triggerUserWhip(contextMenu.memberIndex)
                incrementWhipCount()
                setContextMenu(null)
              }}
            >
              🔥 鞭策一下
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-green-400 transition-colors"
              onClick={() => {
                animatorRef.current?.triggerFeedMember(contextMenu.memberIndex, 'coffee')
                setContextMenu(null)
              }}
            >
              ☕ 投喂咖啡
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-yellow-400 transition-colors"
              onClick={() => {
                animatorRef.current?.triggerFeedMember(contextMenu.memberIndex, 'snack')
                setContextMenu(null)
              }}
            >
              🍪 投喂零食
            </button>
            <button
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-700 text-blue-400 transition-colors"
              onClick={() => {
                animatorRef.current?.triggerFeedMember(contextMenu.memberIndex, 'energy')
                setContextMenu(null)
              }}
            >
              ⚡ 能量饮料
            </button>
          </div>
        </>
      )}

      {/* 没有数据时显示等待界面 */}
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
          {labelPositions.map((label) => {
            const labelFontSize = labelPositions.length > 14 ? '9px' : '10px'
            return (
            <div
              key={label.name}
              className="absolute flex items-center gap-1"
              style={{
                left: `${(label.x / canvasSize.width) * 100}%`,
                top: `${(label.y / canvasSize.height) * 100}%`,
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
              }}
            >
              {label.isCurrentUser && (
                <span className="text-[#00ff88] text-[8px]">▼</span>
              )}
              <span className={`font-medium px-1.5 py-0.5 rounded ${
                label.isCurrentUser
                  ? 'text-[#00ff88] bg-[#00ff88]/20 border border-[#00ff88]/40'
                  : 'text-white bg-black/60'
              }`} style={{ fontSize: labelFontSize }}>
                {label.name}
              </span>
              {label.bugCount > 0 && (
                <span
                  className="font-bold px-1 py-0.5 rounded"
                  style={{
                    fontSize: '9px',
                    backgroundColor: label.bugCount <= 3 ? 'rgba(0,200,100,0.3)' : label.bugCount <= 7 ? 'rgba(255,107,53,0.3)' : 'rgba(255,50,50,0.4)',
                    color: label.bugCount <= 3 ? '#00ff88' : label.bugCount <= 7 ? '#ff6b35' : '#ff4444',
                  }}
                >
                  {label.bugCount}
                </span>
              )}
            </div>
            )
          })}
        </div>
      )}

      {/* 对话气泡覆盖层 */}
      {teamMembers.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-20">
          <AnimatePresence>
            {bubbles.map(bubble => {
              const animator = animatorRef.current
              if (!animator) return null
              const members = animator.getDisplayMembers()
              const memberIndex = members.findIndex(m => m.name === bubble.targetName)
              const pos = memberIndex >= 0 ? animator.getMemberLabelPosition(memberIndex) : null
              if (!pos) return null

              return (
                <motion.div
                  key={bubble.id}
                  initial={{ opacity: 0, scale: 0.8, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, y: -5 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="absolute"
                  style={{
                    left: `${(pos.x / canvasSize.width) * 100}%`,
                    top: `${((pos.y - 28) / canvasSize.height) * 100}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div className={`relative bg-[rgba(20,20,40,0.9)] backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 text-xs max-w-[150px] whitespace-nowrap ${BUBBLE_TEXT_COLORS[bubble.type]}`}>
                    {bubble.text}
                    {/* 底部小三角 */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 bottom-[-6px] w-0 h-0"
                      style={{
                        borderLeft: '4px solid transparent',
                        borderRight: '4px solid transparent',
                        borderTop: '6px solid rgba(20,20,40,0.9)',
                      }}
                    />
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Canvas坐标气泡覆盖层（来自animator的事件/老板/抽人/投喂等气泡） */}
      {canvasBubbles.length > 0 && (
        <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden">
          {canvasBubbles.map(bubble => {
            const leftPercent = (bubble.x / canvasSize.width) * 100
            const topPercent = (bubble.y / canvasSize.height) * 100
            const isShout = bubble.type === 'shout'
            const isThought = bubble.type === 'thought'
            const textColor = bubble.color || (isShout ? '#ff6b6b' : '#ffffff')
            const bgClass = isShout
              ? 'bg-red-900/90 border-red-500/50'
              : isThought
                ? 'bg-gray-800/90 border-gray-600/50'
                : 'bg-[rgba(20,20,40,0.9)] border-white/10'
            const triangleBg = isShout
              ? 'rgba(127,29,29,0.9)'
              : isThought
                ? 'rgba(31,41,55,0.9)'
                : 'rgba(20,20,40,0.9)'

            return (
              <div
                key={bubble.id}
                className="absolute"
                style={{
                  left: `${leftPercent}%`,
                  top: `${topPercent}%`,
                  transform: 'translateX(-50%) translateY(-100%)',
                  animation: 'bubbleFadeIn 0.2s ease-out',
                }}
              >
                <div className={`relative rounded-lg px-2.5 py-1 border text-xs font-bold whitespace-nowrap ${bgClass}`}>
                  <span style={{ color: textColor }}>
                    {bubble.text}
                  </span>
                  {/* 小三角尖 */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bottom-[-6px] w-0 h-0"
                    style={{
                      borderLeft: '4px solid transparent',
                      borderRight: '4px solid transparent',
                      borderTop: `6px solid ${triangleBg}`,
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

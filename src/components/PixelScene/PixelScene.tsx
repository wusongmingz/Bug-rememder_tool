import { useRef, useEffect, useCallback } from 'react'
import { useBugStore } from '../../stores/bugStore'
import { PixelAnimator, getStateFromBugCount, TeamMemberData } from './animator'

export default function PixelScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animatorRef = useRef<PixelAnimator | null>(null)
  const demoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const demoActiveRef = useRef(true)

  const bugs = useBugStore(state => state.bugs)
  const connectionStatus = useBugStore(state => state.connectionStatus)
  const teamMembers = useBugStore(state => state.teamMembers)
  const activeBugCount = bugs.filter(b => b.status === 'active').length

  // Demo 模式逻辑
  const startDemo = useCallback((animator: PixelAnimator) => {
    demoActiveRef.current = true

    // 设置demo团队成员
    const demoTeam: TeamMemberData[] = [
      { name: '张三', bugCount: 3 },
      { name: '李四', bugCount: 7 },
      { name: '王五', bugCount: 1 },
      { name: '赵六', bugCount: 5 },
      { name: '孙七', bugCount: 9 },
      { name: '周八', bugCount: 0 },
    ]
    animator.setTeamMembers(demoTeam)

    let demoBugCount = 0
    let increasing = true
    let demoStep = 0
    const maxSteps = 25

    const demoTick = () => {
      if (!demoActiveRef.current) return

      demoStep++

      if (increasing) {
        demoBugCount++
        if (demoBugCount >= 11) {
          increasing = false
        }
      } else {
        demoBugCount--
        if (demoBugCount <= 0) {
          increasing = true
          demoStep = 0
        }
      }

      animator.setState(getStateFromBugCount(demoBugCount))

      // 在5个bug时触发老板
      if (demoBugCount === 5 && increasing) {
        animator.triggerBoss()
      }

      // 循环 demo
      if (demoStep < maxSteps * 2) {
        demoRef.current = setTimeout(demoTick, 1500)
      } else {
        demoBugCount = 0
        increasing = true
        demoStep = 0
        animator.setState(getStateFromBugCount(0))
        demoRef.current = setTimeout(demoTick, 2000)
      }
    }

    demoRef.current = setTimeout(demoTick, 2000)
  }, [])

  // 初始化 Canvas 和动画器
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const animator = new PixelAnimator(canvas)
    animatorRef.current = animator
    animator.start()

    // 如果未连接，启动demo模式
    if (connectionStatus === 'offline') {
      startDemo(animator)
    }

    return () => {
      animator.destroy()
      animatorRef.current = null
      if (demoRef.current) {
        clearTimeout(demoRef.current)
        demoRef.current = null
      }
      demoActiveRef.current = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 当连接状态变化时处理demo
  useEffect(() => {
    if (connectionStatus === 'online') {
      // 连接成功，停止demo
      demoActiveRef.current = false
      if (demoRef.current) {
        clearTimeout(demoRef.current)
        demoRef.current = null
      }
    } else if (connectionStatus === 'offline' && animatorRef.current && !demoRef.current) {
      // 断线，恢复demo
      startDemo(animatorRef.current)
    }
  }, [connectionStatus, startDemo])

  // 当团队成员数据变化时更新动画器
  useEffect(() => {
    if (!animatorRef.current || demoActiveRef.current) return
    if (teamMembers.length > 0) {
      const memberData: TeamMemberData[] = teamMembers.map(m => ({
        name: m.name,
        bugCount: m.bugCount,
      }))
      animatorRef.current.setTeamMembers(memberData)
    }
  }, [teamMembers])

  // 当Bug数量变化时更新角色状态（真实数据模式）
  useEffect(() => {
    if (!animatorRef.current || demoActiveRef.current) return
    const newState = getStateFromBugCount(activeBugCount)
    animatorRef.current.setState(newState)
  }, [activeBugCount])

  // 检测新Bug到来触发老板
  const prevBugCountRef = useRef(activeBugCount)
  useEffect(() => {
    if (demoActiveRef.current) {
      prevBugCountRef.current = activeBugCount
      return
    }
    // 当有新Bug到来时触发老板（排除初始加载：prev必须>0）
    if (prevBugCountRef.current > 0 && activeBugCount > prevBugCountRef.current) {
      animatorRef.current?.triggerBoss()
    }
    prevBugCountRef.current = activeBugCount
  }, [activeBugCount])

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={220}
      className="w-full h-auto rounded-lg"
      style={{ imageRendering: 'pixelated' }}
    />
  )
}

import { useEffect, useRef, useCallback } from 'react'
import { useBugStore } from '@/stores/bugStore'
import { Bug, TeamMember } from '@/types'

// severity 数字→字符串映射（与 zentao-api.js 保持一致）
const SEVERITY_MAP: Record<number, Bug['severity']> = {
  1: 'fatal',
  2: 'critical',
  3: 'normal',
  4: 'suggestion',
}

function mapSeverity(val: unknown): Bug['severity'] {
  if (typeof val === 'string' && ['fatal', 'critical', 'normal', 'suggestion'].includes(val)) {
    return val as Bug['severity']
  }
  return SEVERITY_MAP[Number(val)] || 'normal'
}

/** 将API返回的原始bug数据映射为标准Bug类型 */
function mapBugData(raw: Record<string, unknown>): Bug {
  return {
    id: Number(raw.id),
    title: (raw.title as string) || '',
    severity: mapSeverity(raw.severity),
    status: (raw.status as string) || 'active',
    assignedTo: (raw.assignedTo as string) || '',
    createdDate: (raw.createdDate as string) || (raw.openedDate as string) || '',
    resolvedDate: (raw.resolvedDate as string) || (raw.closedDate as string) || undefined,
  }
}

// Mock数据（纯web开发模式使用）
const mockBugs: Bug[] = [
  { id: 1, title: '登录页面样式错位', severity: 'normal', status: 'active', assignedTo: '张三', createdDate: '2024-01-15' },
  { id: 2, title: '数据导出内存溢出', severity: 'critical', status: 'active', assignedTo: '李四', createdDate: '2024-01-14' },
  { id: 3, title: '权限校验绕过漏洞', severity: 'fatal', status: 'active', assignedTo: '王五', createdDate: '2024-01-13' },
  { id: 4, title: '图表颜色建议优化', severity: 'suggestion', status: 'active', assignedTo: '赵六', createdDate: '2024-01-12' },
  { id: 5, title: '搜索结果分页异常', severity: 'normal', status: 'resolved', assignedTo: '张三', createdDate: '2024-01-11', resolvedDate: '2024-01-14' },
  { id: 6, title: '文件上传超时未处理', severity: 'critical', status: 'active', assignedTo: '李四', createdDate: '2024-01-10' },
  { id: 7, title: '通知推送延迟严重', severity: 'normal', status: 'active', assignedTo: '王五', createdDate: '2024-01-09' },
  { id: 8, title: '移动端适配问题', severity: 'normal', status: 'resolved', assignedTo: '赵六', createdDate: '2024-01-08', resolvedDate: '2024-01-12' },
]

// Mock团队数据（纯web开发模式使用）
const mockTeamMembers: TeamMember[] = [
  { name: '张三', bugCount: 3, bugs: [] },
  { name: '李四', bugCount: 7, bugs: [] },
  { name: '王五', bugCount: 1, bugs: [] },
  { name: '赵六', bugCount: 5, bugs: [] },
  { name: '孙七', bugCount: 9, bugs: [] },
  { name: '周八', bugCount: 0, bugs: [] },
]

// Mock趋势数据
function generateMockTrend() {
  const data = []
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    data.push({
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      added: Math.floor(Math.random() * 5) + 1,
      resolved: Math.floor(Math.random() * 4),
    })
  }
  return data
}

interface ElectronAPI {
  zentaoConnect: (config: { url: string; username: string; password: string }) => Promise<{ success: boolean; error?: string }>
  zentaoGetBugs: () => Promise<{ success: boolean; bugs?: Record<string, unknown>[]; error?: string }>
  zentaoGetAllBugs: () => Promise<{ success: boolean; bugs?: Record<string, unknown>[]; error?: string }>
  zentaoDisconnect: () => Promise<{ success: boolean }>
  onBugsUpdated?: (callback: (data: { bugs: Record<string, unknown>[]; count: number }) => void) => void
  onNewBugs?: (callback: (bugs: Record<string, unknown>[]) => void) => void
  onApiError?: (callback: (msg: string) => void) => void
  removeAllListeners?: (channel: string) => void
}

function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== 'undefined' && (window as unknown as { electronAPI?: ElectronAPI }).electronAPI) {
    return (window as unknown as { electronAPI: ElectronAPI }).electronAPI
  }
  return null
}

export function useZentao(pollInterval = 60000) {
  const { setBugs, setConnectionStatus, setLastFetched, addTrendPoint, setTeamMembers } = useBugStore()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isElectron = useRef(!!getElectronAPI())

  // 初始化：加载mock数据或连接
  useEffect(() => {
    if (!isElectron.current) {
      // 纯web开发模式，使用mock数据
      setBugs(mockBugs)
      setTeamMembers(mockTeamMembers)
      setConnectionStatus('online')
      setLastFetched(new Date().toLocaleTimeString())

      const trendData = generateMockTrend()
      trendData.forEach((point) => addTrendPoint(point))
    } else {
      // Electron模式：监听主进程推送的Bug更新事件
      const api = getElectronAPI()
      if (api) {
        // 监听轮询推送的bug更新
        api.onBugsUpdated?.((data) => {
          console.log('[useZentao] 收到bugs-updated推送, 数量:', data.count)
          if (data.bugs) {
            const mapped = data.bugs.map(mapBugData)
            setBugs(mapped)
            setLastFetched(new Date().toLocaleTimeString())
            setConnectionStatus('online')
          }
        })

        // 监听API错误
        api.onApiError?.((msg) => {
          console.error('[useZentao] API错误:', msg)
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchBugs = useCallback(async () => {
    const api = getElectronAPI()
    if (!api) return

    try {
      console.log('[useZentao] 主动获取Bug...')
      const result = await api.zentaoGetBugs()
      console.log('[useZentao] zentaoGetBugs返回:', JSON.stringify(result).substring(0, 300))

      if (result && result.success && result.bugs) {
        // IPC返回 { success: true, bugs: [...] }
        const mapped = result.bugs.map(mapBugData)
        console.log('[useZentao] 映射后Bug数量:', mapped.length)
        setBugs(mapped)
        setLastFetched(new Date().toLocaleTimeString())
        setConnectionStatus('online')
      } else if (result && !result.success) {
        console.error('[useZentao] 获取Bug失败:', result.error)
        setConnectionStatus('offline')
        // 自动重连：5秒后重试
        retryTimerRef.current = setTimeout(() => {
          fetchBugs()
        }, 5000)
      }
    } catch (err) {
      console.error('[useZentao] fetchBugs异常:', err)
      setConnectionStatus('offline')
      // 自动重连：5秒后重试
      retryTimerRef.current = setTimeout(() => {
        fetchBugs()
      }, 5000)
    }

    // 同时获取团队Bug数据
    try {
      const allResult = await api.zentaoGetAllBugs()
      if (allResult && allResult.success && allResult.bugs) {
        const allMapped = allResult.bugs.map(mapBugData)
        // 按 assignedTo 分组
        const memberMap = new Map<string, Bug[]>()
        allMapped.forEach(bug => {
          const name = bug.assignedTo || '未指派'
          if (!memberMap.has(name)) memberMap.set(name, [])
          memberMap.get(name)!.push(bug)
        })
        const teamMembers: TeamMember[] = Array.from(memberMap.entries()).map(([name, bugs]) => ({
          name,
          bugCount: bugs.length,
          bugs,
        }))
        setTeamMembers(teamMembers)
      }
    } catch (err) {
      console.log('[useZentao] 获取团队Bug失败(降级):', err)
    }
  }, [setBugs, setLastFetched, setConnectionStatus, setTeamMembers])

  const connect = useCallback(
    async (url: string, username: string, password: string) => {
      const api = getElectronAPI()
      if (!api) return

      setConnectionStatus('connecting')
      console.log('[useZentao] 连接禅道:', url, username)
      try {
        const result = await api.zentaoConnect({ url, username, password })
        console.log('[useZentao] 连接结果:', result)

        if (result && result.success) {
          setConnectionStatus('online')
          await fetchBugs()

          // 启动轮询
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = setInterval(fetchBugs, pollInterval)
        } else {
          console.error('[useZentao] 连接失败:', result?.error)
          setConnectionStatus('offline')
        }
      } catch (err) {
        console.error('[useZentao] 连接异常:', err)
        setConnectionStatus('offline')
      }
    },
    [setConnectionStatus, fetchBugs, pollInterval]
  )

  const disconnect = useCallback(async () => {
    const api = getElectronAPI()
    if (api) {
      await api.zentaoDisconnect()
      // 清除事件监听
      api.removeAllListeners?.('bugs-updated')
      api.removeAllListeners?.('new-bugs')
      api.removeAllListeners?.('api-error')
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    setConnectionStatus('offline')
  }, [setConnectionStatus])

  // 清理
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      // 清除事件监听
      const api = getElectronAPI()
      if (api) {
        api.removeAllListeners?.('bugs-updated')
        api.removeAllListeners?.('new-bugs')
        api.removeAllListeners?.('api-error')
      }
    }
  }, [])

  return { connect, disconnect, fetchBugs }
}

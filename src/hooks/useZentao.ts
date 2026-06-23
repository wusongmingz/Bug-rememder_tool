import { useEffect, useRef, useCallback } from 'react'
import { useBugStore } from '@/stores/bugStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { Bug, TeamMember } from '@/types'

/** 确保当前用户在团队成员列表中，并标记 isCurrentUser */
function ensureCurrentUserInList(members: TeamMember[], currentUsername: string): TeamMember[] {
  if (!currentUsername) return members
  // 找到当前用户（可能匹配 name 或 account）
  const currentUserIndex = members.findIndex(m =>
    m.name === currentUsername || m.account === currentUsername
  )
  if (currentUserIndex === -1) {
    // 用户不在列表中（0个bug），手动添加到首位
    const currentMember: TeamMember = { name: currentUsername, account: currentUsername, bugCount: 0, bugs: [], isCurrentUser: true }
    return [currentMember, ...members]
  }
  // 标记当前用户并放到首位
  const currentMember = { ...members[currentUserIndex], isCurrentUser: true }
  const others = members.filter((_, i) => i !== currentUserIndex)
  return [currentMember, ...others]
}

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

function normalizeStatus(rawStatus: unknown, bug: Record<string, unknown>): string {
  const status = (rawStatus || '').toString().trim().toLowerCase()

  if (status === 'active' || status === '激活') return 'active'
  if (status === 'resolved' || status === '已解决') return 'resolved'
  if (status === 'closed' || status === '已关闭') return 'closed'

  if (!status) {
    if (bug.resolvedDate || bug.resolvedBy || bug.resolution) return 'resolved'
    return 'active'
  }

  return 'resolved'
}

/** 将API返回的原始bug数据映射为标准Bug类型 */
function mapBugData(raw: Record<string, unknown>): Bug {
  return {
    id: Number(raw.id),
    title: (raw.title as string) || '',
    severity: mapSeverity(raw.severity),
    status: normalizeStatus(raw.status, raw) as Bug['status'],
    assignedTo: (raw.assignedTo as string) || '',
    assignedToRealName: (raw.assignedToRealName as string) || (raw.realname as string) || (raw.assignedTo as string) || '',
    createdDate: (raw.createdDate as string) || (raw.openedDate as string) || '',
    resolvedDate: (raw.resolvedDate as string) || (raw.closedDate as string) || undefined,
  }
}



interface ElectronAPI {
  zentaoConnect: (config: { url: string; username: string; password: string }) => Promise<{ success: boolean; error?: string }>
  zentaoGetBugs: () => Promise<{ success: boolean; bugs?: Record<string, unknown>[]; error?: string }>
  zentaoGetAllBugs: () => Promise<{ success: boolean; bugs?: Record<string, unknown>[]; usersMap?: Record<string, string>; error?: string }>
  zentaoDisconnect: () => Promise<{ success: boolean }>
  zentaoGetProductList?: () => Promise<{ success: boolean; products?: { id: number; name: string }[]; error?: string }>
  zentaoShowBugNotification?: (data: { title: string; body: string; bugId: number | string | null }) => Promise<{ success: boolean }>
  storeGet?: (key: string) => Promise<unknown>
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
  const { setBugs, setConnectionStatus, setLastFetched, setTeamMembers } = useBugStore()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isElectron = useRef(!!getElectronAPI())
  const autoConnectedRef = useRef(false)

  const fetchBugs = useCallback(async () => {
    const api = getElectronAPI()
    if (!api) return

    try {
      console.log('[useZentao] 主动获取Bug...')
      const result = await api.zentaoGetBugs()
      console.log('[useZentao] zentaoGetBugs返回:', JSON.stringify(result).substring(0, 300))

      if (result && result.success && result.bugs) {
        const mapped = result.bugs.map(mapBugData)
        console.log('[useZentao] 映射后Bug数量:', mapped.length)
        setBugs(mapped)
        setLastFetched(new Date().toLocaleTimeString())
        setConnectionStatus('online')
      } else if (result && !result.success) {
        console.error('[useZentao] 获取Bug失败:', result.error)
        setConnectionStatus('offline')
        retryTimerRef.current = setTimeout(() => {
          fetchBugs()
        }, 5000)
      }
    } catch (err) {
      console.error('[useZentao] fetchBugs异常:', err)
      setConnectionStatus('offline')
      retryTimerRef.current = setTimeout(() => {
        fetchBugs()
      }, 5000)
    }

    // 同时获取团队Bug数据
    try {
      console.log('[useZentao] fetchBugs: 开始获取团队Bug数据...')
      const allResult = await api.zentaoGetAllBugs()
      console.log('[useZentao] fetchBugs: 团队数据结果:', allResult?.success, '数量:', allResult?.bugs?.length)
      if (allResult && allResult.success && allResult.bugs && allResult.bugs.length > 0) {
        const allMapped = allResult.bugs.map(mapBugData)
        const uniqueBugs = [...new Map(allMapped.map(b => [b.id, b])).values()]

        // 使用 usersMap 构建完整的团队成员列表
        const usersMap: Record<string, string> = (allResult.usersMap as Record<string, string>) || {}
        console.log('[useZentao] fetchBugs: usersMap大小:', Object.keys(usersMap).length)
        const invalidAccounts = new Set(['', 'closed', 'guest', 'system', 'admin'])
        const memberMap = new Map<string, { name: string; account: string; bugCount: number; bugs: Bug[] }>()

        // 先从 usersMap 创建所有成员（即使没有bug也在列表中）
        Object.entries(usersMap).forEach(([account, realName]) => {
          if (invalidAccounts.has(account)) return
          const name = (typeof realName === 'string' ? realName : (realName as unknown as { realname?: string })?.realname) || account
          memberMap.set(account, { name, account, bugCount: 0, bugs: [] })
        })

        // 然后统计每人的 active bug 数量
        uniqueBugs.forEach(bug => {
          const account = bug.assignedTo || ''
          if (!account || account === '未指派') return
          if (!memberMap.has(account)) {
            // usersMap 中可能没有的人（例如已离职但还有bug）
            memberMap.set(account, {
              name: bug.assignedToRealName || account,
              account,
              bugCount: 0,
              bugs: [],
            })
          }
          const member = memberMap.get(account)!
          if (bug.status === 'active') {
            member.bugCount++
            member.bugs.push(bug)
          }
        })

        let teamMembers: TeamMember[] = Array.from(memberMap.values())
        const currentUser = useSettingsStore.getState().username || (await api.storeGet?.('username') as string || '')
        if (currentUser) {
          teamMembers.sort((a, b) => b.bugCount - a.bugCount)
          teamMembers = ensureCurrentUserInList(teamMembers, currentUser)
        }
        setTeamMembers(teamMembers)
      }
    } catch (err) {
      console.log('[useZentao] 获取团队Bug失败(降级):', err)
    }
  }, [setBugs, setLastFetched, setConnectionStatus, setTeamMembers])

  // 初始化：连接禅道（如果有保存的配置则自动重连）
  useEffect(() => {
    if (!isElectron.current) {
      setConnectionStatus('offline')
    } else {
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

          console.log('[useZentao] 开始获取团队Bug数据...')
          api.zentaoGetAllBugs().then(async (allResult) => {
            console.log('[useZentao] 团队数据结果:', allResult?.success, '数量:', allResult?.bugs?.length)
            if (allResult && allResult.success && allResult.bugs && allResult.bugs.length > 0) {
              const allMapped = allResult.bugs.map(mapBugData)
              const uniqueBugs = [...new Map(allMapped.map(b => [b.id, b])).values()]

              // 使用 usersMap 构建完整的团队成员列表
              const usersMap: Record<string, string> = (allResult.usersMap as Record<string, string>) || {}
              console.log('[useZentao] onBugsUpdated: usersMap大小:', Object.keys(usersMap).length)
              const invalidAccounts = new Set(['', 'closed', 'guest', 'system', 'admin'])
              const memberMap = new Map<string, { name: string; account: string; bugCount: number; bugs: Bug[] }>()

              // 先从 usersMap 创建所有成员
              Object.entries(usersMap).forEach(([account, realName]) => {
                if (invalidAccounts.has(account)) return
                const name = (typeof realName === 'string' ? realName : (realName as unknown as { realname?: string })?.realname) || account
                memberMap.set(account, { name, account, bugCount: 0, bugs: [] })
              })

              // 统计每人的 active bug 数量
              uniqueBugs.forEach(bug => {
                const account = bug.assignedTo || ''
                if (!account || account === '未指派') return
                if (!memberMap.has(account)) {
                  memberMap.set(account, {
                    name: bug.assignedToRealName || account,
                    account,
                    bugCount: 0,
                    bugs: [],
                  })
                }
                const member = memberMap.get(account)!
                if (bug.status === 'active') {
                  member.bugCount++
                  member.bugs.push(bug)
                }
              })

              let teamMembers: TeamMember[] = Array.from(memberMap.values())
              const currentUser = useSettingsStore.getState().username || (await api.storeGet?.('username') as string || '')
              if (currentUser) {
                teamMembers.sort((a, b) => b.bugCount - a.bugCount)
                teamMembers = ensureCurrentUserInList(teamMembers, currentUser)
              }
              setTeamMembers(teamMembers)
            }
          }).catch(err => {
            console.log('[useZentao] 团队Bug获取失败(降级):', err)
          })
        })

        // 监听API错误
        api.onApiError?.((msg) => {
          console.error('[useZentao] API错误:', msg)
        })

        // 自动重连：如果有保存的禅道配置，启动时自动连接
        if (!autoConnectedRef.current && api.storeGet) {
          autoConnectedRef.current = true
          Promise.all([
            api.storeGet('zentaoUrl'),
            api.storeGet('username'),
            api.storeGet('password'),
          ]).then(([url, user, pwd]) => {
            if (url && user && pwd) {
              console.log('[useZentao] 检测到已保存的禅道配置，自动连接...')
              setConnectionStatus('connecting')
              api.zentaoConnect({ url: url as string, username: user as string, password: pwd as string })
                .then((result) => {
                  if (result && result.success) {
                    setConnectionStatus('online')
                    // 自动重连成功，保存用户名到 settingsStore
                    useSettingsStore.getState().setUsername(user as string)
                    fetchBugs()
                    // 启动轮询
                    if (timerRef.current) clearInterval(timerRef.current)
                    timerRef.current = setInterval(fetchBugs, pollInterval)
                  } else {
                    console.error('[useZentao] 自动重连失败:', result?.error)
                    setConnectionStatus('offline')
                  }
                })
                .catch((err) => {
                  console.error('[useZentao] 自动重连异常:', err)
                  setConnectionStatus('offline')
                })
            }
          }).catch(() => { /* noop */ })
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
          // 保存用户名到 settingsStore 以供同步访问
          useSettingsStore.getState().setUsername(username)
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

import { useState, useEffect } from 'react'
import { X, Wifi, WifiOff, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import GlassCard from '@/components/Shared/GlassCard'

interface SettingsPanelProps {
  onClose: () => void
}

interface ElectronStoreAPI {
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<boolean>
  zentaoConnect: (config: { url: string; username: string; password: string }) => Promise<{ success: boolean; error?: string }>
  zentaoDisconnect: () => Promise<{ success: boolean }>
}

function getAPI(): ElectronStoreAPI | null {
  if (typeof window !== 'undefined' && (window as unknown as { electronAPI?: ElectronStoreAPI }).electronAPI) {
    return (window as unknown as { electronAPI: ElectronStoreAPI }).electronAPI
  }
  return null
}

function localGet(key: string): string | null {
  try { return localStorage.getItem(`zentao_${key}`) } catch { return null }
}
function localSet(key: string, value: string): void {
  try { localStorage.setItem(`zentao_${key}`, value) } catch { /* noop */ }
}

export default function SettingsPanel({ onClose }: SettingsPanelProps) {
  const [zentaoUrl, setZentaoUrl] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [pollInterval, setPollInterval] = useState(60)
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warn' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'warn' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    const api = getAPI()
    if (api) {
      api.storeGet('zentaoUrl').then((val) => { if (val) setZentaoUrl(val as string) })
      api.storeGet('username').then((val) => { if (val) setUsername(val as string) })
      api.storeGet('password').then((val) => { if (val) setPassword(val as string) })
      api.storeGet('pollInterval').then((val) => {
        if (val) setPollInterval(Math.round((val as number) / 1000))
      })
    } else {
      // Web模式下从localStorage加载
      const url = localGet('url'); if (url) setZentaoUrl(url)
      const user = localGet('username'); if (user) setUsername(user)
      const pwd = localGet('password'); if (pwd) setPassword(pwd)
      const interval = localGet('pollInterval'); if (interval) setPollInterval(Number(interval))
    }
  }, [])

  const handleConnect = async () => {
    const api = getAPI()

    if (!api) {
      // 非Electron环境：保存到localStorage并提示
      localSet('url', zentaoUrl)
      localSet('username', username)
      localSet('password', password)
      localSet('pollInterval', String(pollInterval))
      showToast('请在 Electron 环境中运行以连接禅道（配置已保存到本地）', 'warn')
      return
    }

    setStatus('connecting')
    setErrorMsg('')

    try {
      // 保存轮询间隔
      await api.storeSet('pollInterval', pollInterval * 1000)

      const result = await api.zentaoConnect({ url: zentaoUrl, username, password })
      if (result.success) {
        setStatus('connected')
        showToast('禅道连接成功', 'success')
      } else {
        setStatus('error')
        const msg = result.error || '连接失败'
        setErrorMsg(msg)
        showToast(msg, 'error')
      }
    } catch {
      setStatus('error')
      setErrorMsg('连接异常')
      showToast('连接异常，请检查网络或服务器地址', 'error')
    }
  }

  const handleDisconnect = async () => {
    const api = getAPI()
    if (!api) return

    await api.zentaoDisconnect()
    setStatus('idle')
    showToast('已断开连接', 'success')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <GlassCard className="w-[320px] max-h-[500px] overflow-y-auto relative">
        {/* Toast 提示 */}
        {toast && (
          <div className={`absolute top-2 left-2 right-2 px-3 py-2 rounded-lg text-xs flex items-center gap-1.5 z-10
            ${toast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : ''}
            ${toast.type === 'warn' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : ''}
            ${toast.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : ''}
          `}>
            {toast.type === 'success' && <CheckCircle size={12} />}
            {toast.type === 'warn' && <AlertTriangle size={12} />}
            {toast.type === 'error' && <AlertTriangle size={12} />}
            {toast.msg}
          </div>
        )}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-textPrimary">设置</h2>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded
              text-textSecondary hover:text-textPrimary hover:bg-white/10
              transition-colors duration-150"
          >
            <X size={14} />
          </button>
        </div>

        {/* 禅道配置 */}
        <div className="space-y-3">
          <h3 className="text-xs font-medium text-textSecondary uppercase tracking-wider">禅道连接</h3>

          <div>
            <label className="block text-xs text-textSecondary mb-1">服务器地址</label>
            <input
              type="url"
              value={zentaoUrl}
              onChange={(e) => setZentaoUrl(e.target.value)}
              placeholder="http://your-zentao-server/zentao"
              className="w-full px-3 py-2 rounded-lg text-xs
                bg-[rgba(10,10,30,0.6)] border border-[rgba(255,255,255,0.1)]
                text-textPrimary placeholder-textSecondary/50
                focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/20
                transition-colors duration-150"
            />
          </div>

          <div>
            <label className="block text-xs text-textSecondary mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="输入用户名"
              className="w-full px-3 py-2 rounded-lg text-xs
                bg-[rgba(10,10,30,0.6)] border border-[rgba(255,255,255,0.1)]
                text-textPrimary placeholder-textSecondary/50
                focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/20
                transition-colors duration-150"
            />
          </div>

          <div>
            <label className="block text-xs text-textSecondary mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="输入密码"
              className="w-full px-3 py-2 rounded-lg text-xs
                bg-[rgba(10,10,30,0.6)] border border-[rgba(255,255,255,0.1)]
                text-textPrimary placeholder-textSecondary/50
                focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/20
                transition-colors duration-150"
            />
          </div>

          <div>
            <label className="block text-xs text-textSecondary mb-1">轮询间隔（秒）</label>
            <input
              type="number"
              value={pollInterval}
              onChange={(e) => setPollInterval(Math.max(10, Number(e.target.value)))}
              min={10}
              className="w-full px-3 py-2 rounded-lg text-xs
                bg-[rgba(10,10,30,0.6)] border border-[rgba(255,255,255,0.1)]
                text-textPrimary placeholder-textSecondary/50
                focus:border-accent/50 focus:outline-none focus:ring-1 focus:ring-accent/20
                transition-colors duration-150"
            />
          </div>

          {/* 状态 & 错误信息 */}
          {errorMsg && (
            <p className="text-xs text-red-400">{errorMsg}</p>
          )}

          {status === 'connected' && (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <Wifi size={12} /> 已连接
            </p>
          )}

          {/* 按钮 */}
          <div className="flex gap-2 pt-1">
            {status === 'connected' ? (
              <button
                onClick={handleDisconnect}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium
                  bg-red-500/20 text-red-400 border border-red-500/30
                  hover:bg-red-500/30 transition-colors duration-150
                  flex items-center justify-center gap-1"
              >
                <WifiOff size={12} /> 断开连接
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={status === 'connecting' || !zentaoUrl || !username}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium
                  bg-accent/20 text-accent border border-accent/30
                  hover:bg-accent/30 transition-colors duration-150
                  disabled:opacity-40 disabled:cursor-not-allowed
                  flex items-center justify-center gap-1"
              >
                {status === 'connecting' ? (
                  <><Loader2 size={12} className="animate-spin" /> 连接中...</>
                ) : (
                  <><Wifi size={12} /> 连接</>
                )}
              </button>
            )}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

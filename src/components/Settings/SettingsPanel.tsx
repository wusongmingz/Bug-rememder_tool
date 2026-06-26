import { useState, useEffect } from 'react'
import { X, Wifi, WifiOff, Loader2, CheckCircle, AlertTriangle } from 'lucide-react'
import GlassCard from '@/components/Shared/GlassCard'
import { useSettingsStore } from '@/stores/settingsStore'
import { useBugStore } from '@/stores/bugStore'

interface SettingsPanelProps {
  onClose: () => void
}

interface ElectronStoreAPI {
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<boolean>
  zentaoConnect: (config: { url: string; username: string; password: string }) => Promise<{ success: boolean; error?: string }>
  zentaoDisconnect: () => Promise<{ success: boolean }>
  zentaoGetProductList?: () => Promise<{ success: boolean; products?: { id: number; name: string }[]; error?: string }>
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
  const [localStatus, setLocalStatus] = useState<'idle' | 'connecting' | 'error'>('idle')
  const globalConnectionStatus = useBugStore(state => state.connectionStatus)
  // 如果 bugStore 显示已连接，则按钮显示"断开连接"
  const isConnected = globalConnectionStatus === 'online'
  const [errorMsg, setErrorMsg] = useState('')
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'warn' | 'error' } | null>(null)
  const [products, setProducts] = useState<{ id: number; name: string }[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const { selectedProductIds, setSelectedProductIds } = useSettingsStore()

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
      // 加载已保存的产品勾选
      api.storeGet('selectedProductIds').then((val) => {
        if (val && Array.isArray(val) && val.length > 0) {
          setSelectedProductIds(val as number[])
        }
      })
    } else {
      // Web模式下从localStorage加载
      const url = localGet('url'); if (url) setZentaoUrl(url)
      const user = localGet('username'); if (user) setUsername(user)
      const pwd = localGet('password'); if (pwd) setPassword(pwd)
      const interval = localGet('pollInterval'); if (interval) setPollInterval(Number(interval))
    }
  }, [])

  // 如果已连接，自动加载产品列表
  useEffect(() => {
    if (isConnected && products.length === 0) {
      fetchProducts()
    }
  }, [isConnected])

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

    setLocalStatus('connecting')
    setErrorMsg('')

    try {
      // 保存轮询间隔
      await api.storeSet('pollInterval', pollInterval * 1000)
      // 保存勾选的产品ID列表
      await api.storeSet('selectedProductIds', selectedProductIds)

      const result = await api.zentaoConnect({ url: zentaoUrl, username, password })
      if (result.success) {
        setLocalStatus('idle')
        showToast('禅道连接成功', 'success')
        // 连接成功后自动获取产品列表
        fetchProducts()
      } else {
        setLocalStatus('error')
        const msg = result.error || '连接失败'
        setErrorMsg(msg)
        showToast(msg, 'error')
      }
    } catch {
      setLocalStatus('error')
      setErrorMsg('连接异常')
      showToast('连接异常，请检查网络或服务器地址', 'error')
    }
  }

  const fetchProducts = async () => {
    const api = getAPI()
    if (!api || !api.zentaoGetProductList) return
    setLoadingProducts(true)
    try {
      const result = await api.zentaoGetProductList()
      if (result.success && result.products) {
        setProducts(result.products)
        // 如果用户没有手动选过，默认全选
        if (selectedProductIds.length === 0) {
          const allIds = result.products.map(p => p.id)
          setSelectedProductIds(allIds)
          await api.storeSet('selectedProductIds', allIds)
        }
      }
    } catch (err) {
      console.error('[SettingsPanel] 获取产品列表失败:', err)
    } finally {
      setLoadingProducts(false)
    }
  }

  const handleDisconnect = async () => {
    const api = getAPI()
    if (!api) return

    await api.zentaoDisconnect()
    setLocalStatus('idle')
    showToast('已断开连接', 'success')
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <GlassCard className="relative z-50 w-[320px] max-h-[500px] overflow-y-auto">
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

          {isConnected && (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <Wifi size={12} /> 已连接
            </p>
          )}

          {/* 产品选择区域 */}
          {(products.length > 0 || loadingProducts) && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-xs text-textSecondary">统计项目（取消勾选已停止的项目）</label>
              {loadingProducts ? (
                <div className="flex items-center gap-1 text-xs text-textSecondary">
                  <Loader2 size={12} className="animate-spin" /> 加载产品列表...
                </div>
              ) : (
                <>
                  <div className="max-h-32 overflow-y-auto space-y-0.5 bg-black/20 rounded-lg p-2">
                    {products.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-textPrimary cursor-pointer hover:bg-white/5 px-2 py-1 rounded">
                        <input
                          type="checkbox"
                          checked={selectedProductIds.includes(p.id)}
                          onChange={(e) => {
                            let newIds: number[]
                            if (e.target.checked) {
                              newIds = [...selectedProductIds, p.id]
                            } else {
                              newIds = selectedProductIds.filter(id => id !== p.id)
                            }
                            setSelectedProductIds(newIds)
                            // 实时保存
                            const api = getAPI()
                            if (api) api.storeSet('selectedProductIds', newIds)
                          }}
                          className="accent-[#00ff88] w-4 h-4"
                        />
                        {p.name}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const allIds = products.map(p => p.id)
                        setSelectedProductIds(allIds)
                        const api = getAPI()
                        if (api) api.storeSet('selectedProductIds', allIds)
                      }}
                      className="px-3 py-1.5 text-xs bg-[#00ff88]/20 text-[#00ff88] hover:bg-[#00ff88]/30 rounded transition-colors"
                    >全选</button>
                    <button
                      onClick={() => {
                        setSelectedProductIds([])
                        const api = getAPI()
                        if (api) api.storeSet('selectedProductIds', [])
                      }}
                      className="px-3 py-1.5 text-xs bg-white/10 text-textSecondary hover:bg-white/20 rounded transition-colors"
                    >全不选</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 按钮 */}
          <div className="flex gap-2 pt-1">
            {isConnected ? (
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
                disabled={localStatus === 'connecting' || !zentaoUrl || !username}
                className="flex-1 px-3 py-2 rounded-lg text-xs font-medium
                  bg-accent/20 text-accent border border-accent/30
                  hover:bg-accent/30 transition-colors duration-150
                  disabled:opacity-40 disabled:cursor-not-allowed
                  flex items-center justify-center gap-1"
              >
                {localStatus === 'connecting' ? (
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

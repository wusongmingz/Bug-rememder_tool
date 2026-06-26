import { useState, useRef, useEffect } from 'react'
import { useBugStore } from '@/stores/bugStore'
import type { TeamMember } from '@/types'

interface BugDetailPanelProps {
  bugId: number | null
  onClose: () => void
}

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  fatal: { label: '紧急', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
  critical: { label: '重要', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
  normal: { label: '一般', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
  suggestion: { label: '提示', color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' },
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: '待修复', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  resolved: { label: '已解决', color: 'text-[#00ff88]', bg: 'bg-[#00ff88]/10' },
  closed: { label: '已关闭', color: 'text-gray-400', bg: 'bg-gray-500/10' },
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** 从描述中提取代码块 */
function extractCodeBlocks(text: string): { description: string; codeBlocks: string[] } {
  if (!text) return { description: '', codeBlocks: [] }
  const codeRegex = /```[\w]*\n?([\s\S]*?)```|<code>([\s\S]*?)<\/code>|<pre>([\s\S]*?)<\/pre>/g
  const codeBlocks: string[] = []
  let match
  while ((match = codeRegex.exec(text)) !== null) {
    codeBlocks.push((match[1] || match[2] || match[3]).trim())
  }
  const description = text.replace(codeRegex, '').replace(/<[^>]+>/g, '').trim()
  return { description, codeBlocks }
}

/** 从描述中提取复现步骤 */
function extractSteps(text: string): string[] {
  if (!text) return []
  // 匹配有序列表
  const lines = text.split('\n')
  const steps: string[] = []
  for (const line of lines) {
    const stepMatch = line.match(/^\s*(\d+)[.、)]\s*(.+)/)
    if (stepMatch) {
      steps.push(stepMatch[2].trim())
    }
  }
  return steps
}

/** 去除HTML标签 */
function stripHtml(html: string): string {
  if (!html) return ''
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim()
}

function AssignSection({ bugId, currentAssignee }: { bugId: number; currentAssignee: string }) {
  const [searchText, setSearchText] = useState('')
  const [selectedPerson, setSelectedPerson] = useState('')
  const [selectedName, setSelectedName] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{type: 'success'|'error', text: string} | null>(null)
  const teamMembers = useBugStore(s => s.teamMembers)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 过滤掉当前指派人
  const candidates = teamMembers.filter(m => {
    const id = m.account || m.name
    return id !== currentAssignee
  })

  // 根据搜索文本筛选
  const filteredCandidates = candidates.filter(m =>
    m.name.toLowerCase().includes(searchText.toLowerCase()) ||
    (m.account || '').toLowerCase().includes(searchText.toLowerCase())
  )

  // 点击外部关闭下拉
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (member: TeamMember) => {
    setSelectedPerson(member.account || member.name)
    setSelectedName(member.name)
    setSearchText('')
    setShowDropdown(false)
  }

  const handleAssign = async () => {
    if (!selectedPerson || !bugId) return
    setLoading(true)
    setMessage(null)

    try {
      const result = await window.electronAPI!.zentaoAssignBug(bugId, selectedPerson)
      if (result.success) {
        setMessage({ type: 'success', text: '转指派成功' })
        setSelectedPerson('')
        setSelectedName('')
        setTimeout(() => setMessage(null), 2000)
      } else {
        setMessage({ type: 'error', text: result.error || '转指派失败' })
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '请求失败' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="text-xs text-textSecondary mb-1.5">转指派</div>
      <div className="flex items-center gap-2">
        {/* 可搜索下拉框 */}
        <div className="relative flex-1" ref={dropdownRef}>
          <input
            type="text"
            value={showDropdown ? searchText : selectedName}
            onChange={e => {
              setSearchText(e.target.value)
              setShowDropdown(true)
              if (!e.target.value) {
                setSelectedPerson('')
                setSelectedName('')
              }
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="搜索同事..."
            className="w-full text-xs bg-[#1a1a2e] border border-white/10 rounded px-2 py-1.5 text-textPrimary outline-none focus:border-[#00ff88]/50 placeholder:text-textSecondary/50"
          />
          {showDropdown && filteredCandidates.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-white/10 rounded shadow-lg z-50 max-h-[150px] overflow-y-auto">
              {filteredCandidates.map(m => (
                <div
                  key={m.account || m.name}
                  onClick={() => handleSelect(m)}
                  className="px-2 py-1.5 text-xs text-textPrimary hover:bg-white/10 cursor-pointer transition-colors"
                >
                  {m.name}
                  {m.account && <span className="text-textSecondary ml-1">({m.account})</span>}
                </div>
              ))}
            </div>
          )}
          {showDropdown && filteredCandidates.length === 0 && searchText && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[#1a1a2e] border border-white/10 rounded shadow-lg z-50 px-2 py-2 text-xs text-textSecondary">
              无匹配结果
            </div>
          )}
        </div>
        <button
          onClick={handleAssign}
          disabled={!selectedPerson || loading}
          className="text-xs px-3 py-1.5 rounded bg-[#4a90d9] text-white hover:bg-[#5aa0e9] disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
        >
          {loading ? '...' : '转指派'}
        </button>
      </div>
      {message && (
        <div className={`text-xs mt-1 ${message.type === 'success' ? 'text-[#00ff88]' : 'text-[#ff4444]'}`}>
          {message.text}
        </div>
      )}
    </div>
  )
}

export default function BugDetailPanel({ bugId, onClose }: BugDetailPanelProps) {
  const bugs = useBugStore((s) => s.bugs)
  const [noteInput, setNoteInput] = useState('')

  const bug = bugId !== null ? bugs.find((b) => b.id === bugId) : null

  if (!bug) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-2xl mb-2 opacity-30">🐛</div>
          <div className="text-xs text-textSecondary">选择一个Bug查看详情</div>
        </div>
      </div>
    )
  }

  const severityCfg = SEVERITY_CONFIG[bug.severity] || SEVERITY_CONFIG.normal
  const statusCfg = STATUS_MAP[bug.status] || STATUS_MAP.active

  // 尝试从title/描述中提取有用信息
  const rawDesc = (bug as any).description || ''
  const cleanDesc = stripHtml(rawDesc)
  const { description: parsedDesc, codeBlocks } = extractCodeBlocks(cleanDesc)
  const steps = (bug as any).steps ? extractSteps(stripHtml((bug as any).steps)) : extractSteps(cleanDesc)

  return (
    <div className="h-full flex flex-col">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 flex-shrink-0">
        <span className="text-sm font-medium text-textPrimary flex items-center gap-1.5">
          <span>🐛</span> Bug 详情
        </span>
        <button
          onClick={onClose}
          className="text-textSecondary hover:text-textPrimary text-sm transition-colors w-5 h-5 flex items-center justify-center rounded hover:bg-white/5"
        >
          ×
        </button>
      </div>

      {/* 可滚动内容 */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-3">
        {/* Bug 标题 + 标签 */}
        <div>
          <div className="flex items-start gap-2">
            <h3 className="text-sm font-medium text-textPrimary flex-1 leading-tight">{bug.title}</h3>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0 ${severityCfg.bg} ${severityCfg.color} ${severityCfg.border}`}>
              {severityCfg.label}
            </span>
          </div>
          <div className="mt-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded ${statusCfg.bg} ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
          </div>
        </div>

        {/* 描述 */}
        {parsedDesc && (
          <div className="space-y-1">
            <div className="text-[11px] text-textSecondary font-medium">描述</div>
            <div className="text-xs text-textPrimary/80 leading-relaxed whitespace-pre-wrap">
              {parsedDesc}
            </div>
          </div>
        )}

        {/* 复现步骤 */}
        {steps.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] text-textSecondary font-medium">复现步骤</div>
            <ol className="text-xs text-textPrimary/80 space-y-0.5 pl-4 list-decimal">
              {steps.map((step, i) => (
                <li key={i} className="leading-relaxed">{step}</li>
              ))}
            </ol>
          </div>
        )}

        {/* 代码片段 */}
        {codeBlocks.length > 0 && (
          <div className="space-y-1">
            <div className="text-[11px] text-textSecondary font-medium">代码片段</div>
            {codeBlocks.map((code, idx) => (
              <div key={idx} className="bg-[#1a1a2e] rounded-lg p-2 overflow-x-auto">
                <pre className="font-mono text-[11px] text-textPrimary/80 leading-relaxed">
                  {code.split('\n').map((line, lineIdx) => (
                    <div key={lineIdx} className="flex">
                      <span className="text-textSecondary/40 w-6 text-right mr-2 select-none flex-shrink-0">
                        {lineIdx + 1}
                      </span>
                      <span>{line}</span>
                    </div>
                  ))}
                </pre>
              </div>
            ))}
          </div>
        )}

        {/* 基本信息 */}
        <div className="space-y-1.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-textSecondary">创建时间:</span>
            <span className="text-textPrimary/80">{formatDateTime(bug.createdDate)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-textSecondary">指派给:</span>
            <span className="text-textPrimary/80">{bug.assignedToRealName || bug.assignedTo || '未指派'}</span>
          </div>
          {bug.resolvedDate && (
            <div className="flex items-center gap-2">
              <span className="text-textSecondary">解决时间:</span>
              <span className="text-textPrimary/80">{formatDateTime(bug.resolvedDate)}</span>
            </div>
          )}
        </div>

        {/* 转指派 */}
        <AssignSection bugId={bug.id} currentAssignee={bug.assignedTo} />

        {/* 更新记录（用resolution模拟） */}
        <div className="space-y-1.5">
          <div className="text-[11px] text-textSecondary font-medium">
            更新记录{bug.resolvedDate ? ' (1)' : ' (0)'}
          </div>
          {bug.resolvedDate ? (
            <div className="relative pl-4 border-l border-white/5">
              <div className="absolute left-[-3px] top-1.5 w-2 h-2 rounded-full bg-[#00ff88]" />
              <div className="text-[10px] text-textSecondary/60 mb-0.5">
                {formatDateTime(bug.resolvedDate)}
              </div>
              <div className="text-xs text-textPrimary/80">
                已解决 — {(bug as any).resolution || '修复完成'}
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-textSecondary/50 italic">暂无更新记录</div>
          )}
        </div>
      </div>

      {/* 底部输入框 */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/5 flex-shrink-0">
        <input
          type="text"
          value={noteInput}
          onChange={(e) => setNoteInput(e.target.value)}
          placeholder="添加更新记录..."
          className="flex-1 text-xs bg-black/30 border border-white/10 rounded px-2 py-1.5 text-textPrimary placeholder-textSecondary/50 outline-none focus:border-[#00ff88]/50 transition-colors"
        />
        <button
          onClick={() => setNoteInput('')}
          className="text-xs px-3 py-1.5 rounded bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/30 hover:bg-[#00ff88]/20 transition-colors"
        >
          发送
        </button>
      </div>
    </div>
  )
}

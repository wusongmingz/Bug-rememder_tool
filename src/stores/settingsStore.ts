import { create } from 'zustand'
import { ViewType } from '../types'

interface SettingsState {
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  alwaysOnTop: boolean
  toggleAlwaysOnTop: () => void
  selectedProductIds: number[]
  setSelectedProductIds: (ids: number[]) => void
  selectedMembers: string[]  // 用户选择要显示的同事账号列表
  setSelectedMembers: (members: string[]) => void
  username: string  // 当前登录禅道的账号名
  setUsername: (name: string) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  currentView: 'bugs',
  setCurrentView: (view) => set({ currentView: view }),
  alwaysOnTop: false,
  toggleAlwaysOnTop: () => set((state) => ({ alwaysOnTop: !state.alwaysOnTop })),
  selectedProductIds: [],
  setSelectedProductIds: (ids) => set({ selectedProductIds: ids }),
  selectedMembers: [],
  setSelectedMembers: (members) => {
    set({ selectedMembers: members })
    // 持久化到 electron-store
    if (typeof window !== 'undefined' && (window as any).electronAPI?.storeSet) {
      (window as any).electronAPI.storeSet('selectedMembers', members)
    }
  },
  username: '',
  setUsername: (name) => set({ username: name }),
}))

// 应用启动时从 electron-store 加载持久化数据
if (typeof window !== 'undefined' && (window as any).electronAPI?.storeGet) {
  (window as any).electronAPI.storeGet('selectedMembers').then((val: unknown) => {
    if (val && Array.isArray(val) && val.length > 0) {
      useSettingsStore.getState().setSelectedMembers(val as string[])
    }
  }).catch(() => { /* noop */ })

  // 加载当前登录用户名
  ;(window as any).electronAPI.storeGet('username').then((val: unknown) => {
    if (val && typeof val === 'string') {
      useSettingsStore.getState().setUsername(val)
    }
  }).catch(() => { /* noop */ })
}

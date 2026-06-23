import { create } from 'zustand'
import { ViewType } from '../types'

interface SettingsState {
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  alwaysOnTop: boolean
  toggleAlwaysOnTop: () => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  currentView: 'bugs',
  setCurrentView: (view) => set({ currentView: view }),
  alwaysOnTop: false,
  toggleAlwaysOnTop: () => set((state) => ({ alwaysOnTop: !state.alwaysOnTop })),
}))

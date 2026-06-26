/// <reference types="vite/client" />

interface ElectronAPI {
  storeGet: (key: string) => Promise<any>
  storeSet: (key: string, value: any) => Promise<void>
  zentaoConnect: (config: any) => Promise<any>
  zentaoGetBugs: () => Promise<any>
  zentaoDisconnect: () => Promise<void>
  windowMinimize: () => Promise<void>
  windowClose: () => Promise<void>
  windowTogglePin: () => Promise<void>
  notificationShow: (options: any) => Promise<void>
  zentaoShowBugNotification?: (data: { title: string; body: string; bugId: number | string | null }) => Promise<{ success: boolean }>
  zentaoAssignBug: (bugId: number, assignedTo: string) => Promise<{ success: boolean; error?: string; data?: any }>
  onBugsUpdated: (callback: (data: any) => void) => void
  onNewBugs: (callback: (bugs: any) => void) => void
  onApiError: (callback: (msg: string) => void) => void
  removeAllListeners: (channel: string) => void
  zentaoAssignBug: (bugId: number, assignedTo: string) => Promise<{success: boolean, error?: string}>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}

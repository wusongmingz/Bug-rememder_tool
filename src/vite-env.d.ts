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
  onBugsUpdated: (callback: (data: any) => void) => void
  onNewBugs: (callback: (bugs: any) => void) => void
  onApiError: (callback: (msg: string) => void) => void
  removeAllListeners: (channel: string) => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}

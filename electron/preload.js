const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Zentao
  zentaoConnect: (config) => ipcRenderer.invoke('zentao:connect', config),
  zentaoGetBugs: () => ipcRenderer.invoke('zentao:getBugs'),
  zentaoGetAllBugs: () => ipcRenderer.invoke('zentao:getAllBugs'),
  zentaoDisconnect: () => ipcRenderer.invoke('zentao:disconnect'),
  zentaoGetProductList: () => ipcRenderer.invoke('zentao:getProductList'),

  // Store
  storeGet: (key) => ipcRenderer.invoke('store:get', key),
  storeSet: (key, value) => ipcRenderer.invoke('store:set', key, value),

  // Window
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowClose: () => ipcRenderer.send('window:close'),
  windowTogglePin: () => ipcRenderer.invoke('window:togglePin'),

  // Notification
  showNotification: (title, body) => ipcRenderer.send('notification:show', title, body),
  zentaoShowBugNotification: (data) => ipcRenderer.invoke('zentao:showBugNotification', data),

  // 监听事件
  onBugsUpdated: (callback) => {
    ipcRenderer.on('bugs-updated', (_event, data) => callback(data));
  },
  onNewBugs: (callback) => {
    ipcRenderer.on('new-bugs', (_event, bugs) => callback(bugs));
  },
  onApiError: (callback) => {
    ipcRenderer.on('api-error', (_event, msg) => callback(msg));
  },

  // 移除监听
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
});

// 兼容旧API（向后兼容）
contextBridge.exposeInMainWorld('zentaoAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  refreshBugs: () => ipcRenderer.invoke('refresh-bugs'),
  getBugCount: () => ipcRenderer.invoke('get-bug-count'),
  onBugsUpdated: (callback) => {
    ipcRenderer.on('bugs-updated', (_event, data) => callback(data));
  },
  onNewBugs: (callback) => {
    ipcRenderer.on('new-bugs', (_event, bugs) => callback(bugs));
  },
  onApiError: (callback) => {
    ipcRenderer.on('api-error', (_event, msg) => callback(msg));
  },
});

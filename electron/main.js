const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, Notification, screen, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const ZentaoAPI = require('./zentao-api');

const store = new Store();

let mainWindow = null;
let tray = null;
let zentaoApi = null;
let pollTimer = null;

const isDev = !app.isPackaged;

// 创建主窗口
function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

  const winWidth = 750;
  const winHeight = 720;

  const savedPos = store.get('windowPosition', { x: -1, y: -1 });
  let x = savedPos.x >= 0 ? savedPos.x : screenWidth - winWidth - 20;
  let y = savedPos.y >= 0 ? savedPos.y : screenHeight - winHeight - 20;

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    minWidth: 600,
    x: x,
    y: y,
    frame: false,
    transparent: true,
    alwaysOnTop: store.get('alwaysOnTop', true),
    resizable: true,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.setIgnoreMouseEvents(false);

  // 窗口位置保存
  mainWindow.on('moved', () => {
    const [nx, ny] = mainWindow.getPosition();
    store.set('windowPosition', { x: nx, y: ny });
  });

  // 关闭窗口时隐藏到托盘而不是退出
  mainWindow.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 创建系统托盘
function createTray() {
  tray = new Tray(createTrayIcon());
  updateTrayMenu();
  tray.setToolTip('Bug Work - 程序员效率工具');

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });
}

// 创建托盘图标（绿色圆点16x16）
function createTrayIcon() {
  const size = 16;
  const canvas = Buffer.alloc(size * size * 4);

  // 绘制绿色圆点
  const cx = 8, cy = 8, r = 6;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= r) {
        const idx = (y * size + x) * 4;
        canvas[idx] = 0;       // R
        canvas[idx + 1] = 200; // G
        canvas[idx + 2] = 100; // B
        canvas[idx + 3] = 255; // A
      }
    }
  }

  return nativeImage.createFromBuffer(canvas, { width: size, height: size, scaleFactor: 1.0 });
}

// 更新托盘菜单
function updateTrayMenu() {
  const isOnTop = mainWindow ? mainWindow.isAlwaysOnTop() : store.get('alwaysOnTop', true);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示/隐藏',
      click: () => {
        if (mainWindow) {
          mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
        }
      }
    },
    {
      label: `置顶: ${isOnTop ? '开' : '关'}`,
      click: () => {
        if (mainWindow) {
          const newState = !mainWindow.isAlwaysOnTop();
          mainWindow.setAlwaysOnTop(newState);
          store.set('alwaysOnTop', newState);
          updateTrayMenu();
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    },
  ]);
  tray.setContextMenu(contextMenu);
}

// 获取Bug数据
let lastBugIds = new Set();

async function fetchBugs() {
  if (!zentaoApi) return;

  try {
    console.log('[Main] 开始轮询获取Bug...');
    const bugs = await zentaoApi.getMyBugs();
    console.log('[Main] 获取到Bug数量:', bugs.length);
    const currentBugIds = new Set(bugs.map(b => b.id));

    // 检测新Bug
    const newBugs = bugs.filter(b => !lastBugIds.has(b.id));

    if (lastBugIds.size > 0 && newBugs.length > 0) {
      if (mainWindow) {
        mainWindow.webContents.send('new-bugs', newBugs);
      }

      newBugs.forEach(bug => {
        new Notification({
          title: '新Bug来了！',
          body: `#${bug.id} ${bug.title}`,
          silent: false,
        }).show();
      });
    }

    lastBugIds = currentBugIds;

    if (mainWindow) {
      mainWindow.webContents.send('bugs-updated', { bugs, count: bugs.length });
    }
  } catch (err) {
    console.error('[Main] 获取Bug失败:', err.message);
    if (mainWindow) {
      mainWindow.webContents.send('api-error', err.message);
    }
  }
}

// 开始轮询
function startPolling() {
  fetchBugs();
  const interval = store.get('pollInterval', 60000);
  pollTimer = setInterval(fetchBugs, interval);
}

// IPC处理 - 禅道相关
ipcMain.handle('zentao:connect', async (event, { url, username, password }) => {
  try {
    console.log('[Main] zentao:connect 请求:', url, username);
    store.set('zentaoUrl', url);
    store.set('username', username);
    store.set('password', password);
    zentaoApi = new ZentaoAPI(url, username, password);
    await zentaoApi.login();
    console.log('[Main] 禅道登录成功');
    if (pollTimer) clearInterval(pollTimer);
    startPolling();
    return { success: true };
  } catch (err) {
    console.error('[Main] zentao:connect 失败:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('zentao:getBugs', async () => {
  if (!zentaoApi) {
    console.log('[Main] zentao:getBugs - 未连接');
    return { success: false, error: '未连接禅道' };
  }
  try {
    const bugs = await zentaoApi.getMyBugs();
    console.log('[Main] zentao:getBugs 返回数量:', bugs.length);
    return { success: true, bugs };
  } catch (err) {
    console.error('[Main] zentao:getBugs 失败:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('zentao:getAllBugs', async () => {
  if (!zentaoApi) {
    console.log('[Main] zentao:getAllBugs - 未连接');
    return { success: false, error: '未连接禅道' };
  }
  try {
    // 优先使用用户勾选的产品ID列表
    const selectedProductIds = store.get('selectedProductIds', []);
    let productIdParam;
    if (selectedProductIds && selectedProductIds.length > 0) {
      productIdParam = selectedProductIds;
    } else {
      // 回退到旧的productId字符串配置
      productIdParam = store.get('productId', '');
    }
    const result = await zentaoApi.getAllBugs(productIdParam);
    console.log('[Main] zentao:getAllBugs 返回数量:', result.bugs.length, 'usersMap大小:', Object.keys(result.usersMap).length);
    return { success: true, bugs: result.bugs, usersMap: result.usersMap };
  } catch (err) {
    console.error('[Main] zentao:getAllBugs 失败:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('zentao:disconnect', () => {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
  zentaoApi = null;
  lastBugIds = new Set();
  return { success: true };
});

ipcMain.handle('zentao:getProductList', async () => {
  if (!zentaoApi) {
    return { success: false, error: '未连接禅道' };
  }
  try {
    const products = await zentaoApi.getProductList();
    return { success: true, products };
  } catch (err) {
    console.error('[Main] zentao:getProductList 失败:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('zentao:assignBug', async (event, bugId, assignedTo) => {
  if (!zentaoApi) {
    return { success: false, error: '未连接禅道' };
  }
  try {
    const result = await zentaoApi.assignBug(bugId, assignedTo);

    // 转指派成功后立即刷新Bug列表
    if (result.success) {
      fetchBugs();
    }

    return result;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC处理 - electron-store
ipcMain.handle('store:get', (event, key) => {
  return store.get(key, null);
});

ipcMain.handle('store:set', (event, key, value) => {
  store.set(key, value);
  return true;
});

// IPC处理 - 窗口控制
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.hide();
});

ipcMain.handle('window:togglePin', () => {
  if (mainWindow) {
    const isOnTop = mainWindow.isAlwaysOnTop();
    mainWindow.setAlwaysOnTop(!isOnTop);
    store.set('alwaysOnTop', !isOnTop);
    updateTrayMenu();
    return !isOnTop;
  }
  return false;
});

// IPC处理 - 通知
ipcMain.on('notification:show', (event, title, body) => {
  new Notification({ title, body, silent: false }).show();
});

// IPC处理 - 新Bug系统通知（支持点击跳转禅道）
ipcMain.handle('zentao:showBugNotification', async (event, { title, body, bugId }) => {
  const zentaoUrl = store.get('zentaoUrl', '');

  const notifOptions = {
    title: title || '新Bug提醒',
    body: body || '',
    urgency: 'normal',
    silent: false,
  };

  const notification = new Notification(notifOptions);

  notification.on('click', () => {
    // 点击通知时打开禅道Bug详情
    if (zentaoUrl && bugId) {
      const bugUrl = `${zentaoUrl}/bug-view-${bugId}.html`;
      shell.openExternal(bugUrl);
    }
    // 恢复窗口
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
    }
  });

  notification.show();
  return { success: true };
});

// 初始化禅道API（自动连接）
function initZentaoApi() {
  const url = store.get('zentaoUrl');
  const username = store.get('username');
  const password = store.get('password');
  if (url && username) {
    console.log('[Main] 自动连接禅道:', url, username);
    zentaoApi = new ZentaoAPI(url, username, password);
    if (pollTimer) clearInterval(pollTimer);
    startPolling();
  } else {
    console.log('[Main] 无保存的禅道配置，跳过自动连接');
  }
}

// 应用启动
app.whenReady().then(() => {
  app.setAppUserModelId('com.bugwork.pixel-office');
  createWindow();
  createTray();
  initZentaoApi();
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('before-quit', () => {
  app.isQuitting = true;
  if (pollTimer) clearInterval(pollTimer);
});

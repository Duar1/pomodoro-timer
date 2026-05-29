const { app, BrowserWindow, Tray, Menu, Notification, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Single instance lock — prevent multiple windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let win = null;
let tray = null;
let forceQuit = false;

function getDataPath(filename) {
  return path.join(app.getPath('userData'), filename);
}

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 720,
    minWidth: 380,
    minHeight: 600,
    show: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
  });

  win.on('close', (e) => {
    if (!forceQuit) {
      e.preventDefault();
      win.hide();
    }
  });
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'assets', 'icon.png'));
  tray.setToolTip('番茄钟');
  tray.on('click', () => {
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });
  updateTrayMenu(false);
}

function updateTrayMenu(isRunning) {
  if (!tray) return;
  const menu = Menu.buildFromTemplate([
    {
      label: win && win.isVisible() ? '隐藏' : '显示',
      click: () => {
        if (win.isVisible()) {
          win.hide();
        } else {
          win.show();
          win.focus();
        }
      },
    },
    {
      label: isRunning ? '暂停' : '开始',
      click: () => win && win.webContents.send('tray-command', 'start-pause'),
    },
    {
      label: '重置',
      click: () => win && win.webContents.send('tray-command', 'reset'),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        forceQuit = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

// IPC Handlers
ipcMain.handle('load-data', async () => {
  const read = (file) => {
    try {
      const p = getDataPath(file);
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
      }
    } catch {}
    return null;
  };
  return {
    settings: read('settings.json'),
    tasks: read('tasks.json'),
    historyData: read('history.json'),
  };
});

ipcMain.handle('save-data', async (_event, data) => {
  try {
    if (data.settings !== undefined) {
      fs.writeFileSync(getDataPath('settings.json'), JSON.stringify(data.settings, null, 2));
    }
    if (data.tasks !== undefined) {
      fs.writeFileSync(getDataPath('tasks.json'), JSON.stringify(data.tasks, null, 2));
    }
    if (data.historyData !== undefined) {
      fs.writeFileSync(getDataPath('history.json'), JSON.stringify(data.historyData, null, 2));
    }
    return true;
  } catch (e) {
    return false;
  }
});

ipcMain.on('notification', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
});

ipcMain.on('set-always-on-top', (_event, flag) => {
  if (win) win.setAlwaysOnTop(flag);
});

ipcMain.on('minimize-to-tray', () => {
  if (win) win.hide();
});

ipcMain.on('tray-menu-update', (_event, isRunning) => {
  updateTrayMenu(isRunning);
});

// When second instance is launched, focus the existing window
app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
});

// App lifecycle
app.whenReady().then(() => {
  app.setAppUserModelId('com.pomodoro.timer');
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

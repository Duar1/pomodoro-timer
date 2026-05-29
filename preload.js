const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  sendNotification: (title, body) => ipcRenderer.send('notification', { title, body }),
  setAlwaysOnTop: (flag) => ipcRenderer.send('set-always-on-top', flag),
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  updateTrayMenu: (isRunning) => ipcRenderer.send('tray-menu-update', isRunning),
  onTrayCommand: (callback) => {
    ipcRenderer.on('tray-command', (_event, command) => callback(command));
  },
});

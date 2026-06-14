const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pomodoroAPI', {
  // send tray update
  updateTray: (data) => ipcRenderer.send('update-tray', data),

  // always-on-top
  getAlwaysOnTop: () => ipcRenderer.invoke('get-always-on-top'),
  setAlwaysOnTop: (val) => ipcRenderer.send('set-always-on-top', val),

  // desktop notification
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),

  // global shortcuts from main process
  onShortcut: (callback) => {
    ipcRenderer.on('shortcut', (_event, action) => callback(action));
  },
});

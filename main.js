const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, globalShortcut, Notification, screen } = require('electron');
const path = require('path');

// ── state ────────────────────────────────────
let win = null;
let tray = null;
let isQuitting = false;
let alwaysOnTop = false;

const APP_NAME = '番茄钟';

// ── create icon programmatically (16x16 PNG as data URL → NativeImage) ──
function createIcon(color = '#e94560', size = 16) {
  // Draw a simple filled circle as tray icon
  const canvas = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2, r = size / 2 - 2;
  const rr = parseInt(color.slice(1,3), 16);
  const gg = parseInt(color.slice(3,5), 16);
  const bb = parseInt(color.slice(5,7), 16);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const idx = (y * size + x) * 4;
      if (dist <= r) {
        canvas[idx] = rr; canvas[idx+1] = gg; canvas[idx+2] = bb; canvas[idx+3] = 255;
      } else {
        canvas[idx] = 0; canvas[idx+1] = 0; canvas[idx+2] = 0; canvas[idx+3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(canvas, { width: size, height: size });
}

// ── window ────────────────────────────────────
function createWindow() {
  const { width: screenW } = screen.getPrimaryDisplay().workAreaSize;
  const winW = 440, winH = 600;
  win = new BrowserWindow({
    width: winW,
    height: winH,
    x: Math.round((screenW - winW) / 2),
    y: 60,
    resizable: false,
    title: APP_NAME,
    icon: createIcon('#e94560', 32),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    show: false,
  });
  win.loadFile('app.html');
  win.once('ready-to-show', () => { win.show(); });
  win.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide(); // minimize to tray
    }
  });
  win.on('closed', () => { win = null; });
}

// ── tray ──────────────────────────────────────
function createTray() {
  tray = new Tray(createIcon('#e94560', 16));
  tray.setToolTip(APP_NAME);

  tray.on('click', () => {
    if (win) {
      win.isVisible() ? win.hide() : win.show();
    }
  });

  updateTrayMenu();
}

function updateTrayMenu(timerText, modeLabel) {
  if (!tray) return;
  const contextMenu = Menu.buildFromTemplate([
    { label: timerText ? `${timerText} — ${modeLabel}` : APP_NAME, enabled: false },
    { type: 'separator' },
    {
      label: `置顶窗口  ${alwaysOnTop ? '✓' : ''}`,
      click: () => {
        alwaysOnTop = !alwaysOnTop;
        if (win) win.setAlwaysOnTop(alwaysOnTop);
        updateTrayMenu(timerText, modeLabel);
      }
    },
    {
      label: '显示窗口',
      click: () => { if (win) { win.show(); win.focus(); } }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    },
  ]);
  tray.setContextMenu(contextMenu);
}

// ── global shortcuts ──────────────────────────
function registerShortcuts() {
  globalShortcut.register('Alt+Space', () => {
    if (!win) return;
    win.webContents.send('shortcut', 'toggle');
  });
  globalShortcut.register('Alt+R', () => {
    if (!win) return;
    win.webContents.send('shortcut', 'reset');
  });
  globalShortcut.register('Alt+S', () => {
    if (!win) return;
    win.webContents.send('shortcut', 'skip');
  });
}

// ── IPC handlers ──────────────────────────────
function setupIPC() {
  ipcMain.handle('get-always-on-top', () => alwaysOnTop);

  ipcMain.on('update-tray', (_event, { timerText, modeLabel }) => {
    updateTrayMenu(timerText, modeLabel);
  });

  ipcMain.on('set-always-on-top', (_event, val) => {
    alwaysOnTop = val;
    if (win) win.setAlwaysOnTop(val);
    updateTrayMenu();
  });

  ipcMain.on('notify', (_event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body, silent: true }).show();
    }
  });
}

// ── app lifecycle ─────────────────────────────
app.whenReady().then(() => {
  setupIPC();
  createWindow();
  createTray();
  registerShortcuts();

  app.on('activate', () => {
    if (win) win.show();
  });
});

app.on('window-all-closed', () => {
  // keep running in tray — do nothing
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// macOS: prevent double dock icon
if (process.platform === 'darwin') app.dock?.hide();

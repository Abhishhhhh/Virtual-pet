// main.js — Electron main process
// Owns: the transparent full-screen overlay window, the tray menu,
// cursor polling (the window ignores mouse events, so we can't rely on
// DOM mousemove — we poll the OS cursor position instead), settings
// persistence (pet name + house location + start-at-login) to a JSON
// file in userData, and the start-at-login OS integration.

const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let petWindow = null;
let renameWindow = null;
let tray = null;
let cursorPollTimer = null;

const settingsPath = path.join(app.getPath('userData'), 'pet-settings.json');

function loadSettings() {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    return { name: 'Buddy', houseX: null, houseY: null, startAtLogin: false, ...JSON.parse(raw) };
  } catch {
    return { name: 'Buddy', houseX: null, houseY: null, startAtLogin: false };
  }
}

function saveSettings() {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

let settings = loadSettings();

function applyLoginItemSettings() {
  // Note: this points at whatever binary is currently running. In dev
  // (`npm start`) that's the bare Electron binary in node_modules, which
  // won't reliably reopen this project on login. It works correctly once
  // the app is packaged (`npm run dist:mac` / `dist:win`) and installed.
  app.setLoginItemSettings({
    openAtLogin: !!settings.startAtLogin,
    openAsHidden: true,
  });
}

function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  petWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    fullscreenable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Make the overlay click-through so it never blocks other apps.
  petWindow.setIgnoreMouseEvents(true, { forward: true });
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  petWindow.setAlwaysOnTop(true, 'screen-saver');

  if (settings.houseX == null || settings.houseY == null) {
    settings.houseX = width - 140;
    settings.houseY = height - 140;
    saveSettings();
  }

  petWindow.loadFile(path.join(__dirname, 'src/renderer/index.html'));

  petWindow.webContents.once('did-finish-load', () => {
    petWindow.webContents.send('init', { ...settings, screenWidth: width, screenHeight: height });
  });

  startCursorPolling();
}

function startCursorPolling() {
  // ~30fps is plenty for a desktop companion and keeps CPU near zero.
  cursorPollTimer = setInterval(() => {
    if (!petWindow || petWindow.isDestroyed()) return;
    const point = screen.getCursorScreenPoint();
    petWindow.webContents.send('cursor', point);
  }, 33);
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: settings.name, enabled: false },
    { type: 'separator' },
    { label: 'Call pet here', click: () => petWindow?.webContents.send('command', 'call') },
    { label: 'Send to play', click: () => petWindow?.webContents.send('command', 'play') },
    { label: 'Send to sleep', click: () => petWindow?.webContents.send('command', 'sleep') },
    { type: 'separator' },
    { label: 'Rename pet…', click: openRenameWindow },
    {
      label: 'Start at Login',
      type: 'checkbox',
      checked: !!settings.startAtLogin,
      click: () => {
        settings.startAtLogin = !settings.startAtLogin;
        saveSettings();
        applyLoginItemSettings();
        tray.setContextMenu(buildTrayMenu());
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets/icon.png');
  let icon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createEmpty();
  if (!icon.isEmpty()) icon = icon.resize({ width: 16, height: 16 });
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip('Virtual Pet');
  tray.setContextMenu(buildTrayMenu());
}

function openRenameWindow() {
  if (renameWindow) {
    renameWindow.focus();
    return;
  }
  renameWindow = new BrowserWindow({
    width: 320,
    height: 160,
    resizable: false,
    minimizable: false,
    maximizable: false,
    title: 'Rename your pet',
    webPreferences: {
      preload: path.join(__dirname, 'preload-rename.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  renameWindow.setMenuBarVisibility(false);
  renameWindow.loadFile(path.join(__dirname, 'src/renderer/rename.html'));
  renameWindow.on('closed', () => { renameWindow = null; });
}

ipcMain.on('rename-submit', (_event, newName) => {
  if (typeof newName === 'string' && newName.trim()) {
    settings.name = newName.trim().slice(0, 24);
    saveSettings();
    tray.setContextMenu(buildTrayMenu());
    petWindow?.webContents.send('renamed', settings.name);
  }
  renameWindow?.close();
});

ipcMain.on('rename-cancel', () => renameWindow?.close());

app.whenReady().then(() => {
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
  createPetWindow();
  createTray();
  applyLoginItemSettings();
});

// This is a tray/menu-bar app: keep it alive even with no window focused.
app.on('window-all-closed', (e) => e.preventDefault());

const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const { scanProject } = require('./scanner');
const { createAuthStore } = require('./auth');

function isWindowExpanded(window) {
  const bounds = window.getBounds();
  return window.isMaximized() || bounds.width >= 1400 || bounds.height >= 900;
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    backgroundColor: '#f5f6f2',
    title: '',
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.loadFile('index.html');
  window.maximize();
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  const auth = createAuthStore(app.getPath('userData'));
  ipcMain.handle('auth-session', () => auth.getSession());
  ipcMain.handle('auth-signup', (_event, credentials) => auth.signup(credentials));
  ipcMain.handle('auth-signup-code', (_event, credentials) => auth.requestSignupCode(credentials));
  ipcMain.handle('auth-verify-code', (_event, credentials) => auth.verifySignupCode(credentials));
  ipcMain.handle('auth-complete-signup', (_event, credentials) => auth.completeSignup(credentials));
  ipcMain.handle('auth-login', (_event, credentials) => auth.login(credentials));
  ipcMain.handle('auth-social-login', (_event, provider) => auth.socialLogin(provider));
  ipcMain.handle('auth-logout', () => auth.logout());
  ipcMain.handle('choose-project', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle('clone-repo', async (_event, repoUrl) => {
    const result = await dialog.showOpenDialog({ title: 'Escolha onde clonar o repositório', properties: ['openDirectory', 'createDirectory'] });
    if (result.canceled) return null;
    return new Promise((resolve, reject) => {
      execFile('git', ['clone', repoUrl, result.filePaths[0]], { windowsHide: true }, (error, _stdout, stderr) => {
        if (error) return reject(new Error(stderr.trim() || 'Não foi possível clonar o repositório.'));
        resolve(result.filePaths[0]);
      });
    });
  });

  ipcMain.handle('scan-project', async (_event, projectPath) => scanProject(projectPath));
  ipcMain.handle('open-file', async (_event, filePath) => {
    await shell.openPath(filePath);
  });
  ipcMain.handle('window-minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize());
  ipcMain.handle('window-toggle-maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return false;
    const expanded = isWindowExpanded(window);
    if (!expanded) window.maximize();
    else {
      window.unmaximize();
      window.setSize(1100, 700);
      window.center();
    }
    return !expanded;
  });
  ipcMain.handle('window-is-maximized', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window ? isWindowExpanded(window) : false;
  });
  ipcMain.handle('window-close', (event) => BrowserWindow.fromWebContents(event.sender)?.close());

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
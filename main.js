const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { scanProject } = require('./scanner');
const { createAuthStore } = require('./auth');

function isWindowExpanded(window) {
  const bounds = window.getBounds();
  return window.isMaximized() || bounds.width >= 1400 || bounds.height >= 900;
}

function getTerminalCommand() {
  if (process.platform === 'win32') {
    const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    if (fs.existsSync(powershell)) return { command: powershell, args: ['-NoLogo', '-NoProfile'] };
    return { command: process.env.ComSpec || 'cmd.exe', args: ['/Q', '/D'] };
  }
  const command = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash');
  return { command, args: ['-i'] };
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
  const terminalSessions = new Map();
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
  ipcMain.handle('material-icon-catalog', async () => JSON.parse(await fs.promises.readFile(path.join(__dirname, 'assets', 'material-icons.json'), 'utf8')));
  ipcMain.handle('terminal-create', (event, { cwd }) => {
    if (!cwd || !fs.existsSync(cwd)) throw new Error('Diretório do terminal não encontrado.');
    const terminal = getTerminalCommand();
    const processHandle = spawn(terminal.command, terminal.args, { cwd, env: process.env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    terminalSessions.set(id, processHandle);
    const send = (data) => event.sender.send('terminal-data', { id, data: data.toString() });
    processHandle.stdout.on('data', send);
    processHandle.stderr.on('data', send);
    processHandle.on('close', (code) => { event.sender.send('terminal-exit', { id, code }); terminalSessions.delete(id); });
    processHandle.on('error', (error) => { event.sender.send('terminal-data', { id, data: `\r\nErro ao iniciar terminal: ${error.message}\r\n` }); });
    return { id, shell: path.basename(terminal.command), platform: process.platform };
  });
  ipcMain.handle('terminal-write', (_event, { id, input }) => {
    const processHandle = terminalSessions.get(id);
    if (!processHandle || !processHandle.stdin.writable) return false;
    processHandle.stdin.write(input);
    return true;
  });
  ipcMain.handle('terminal-kill', (_event, { id }) => {
    const processHandle = terminalSessions.get(id);
    if (!processHandle) return false;
    processHandle.kill();
    terminalSessions.delete(id);
    return true;
  });
  ipcMain.handle('write-file', async (_event, { projectPath, filePath, content }) => {
    const root = path.resolve(projectPath);
    const target = path.resolve(filePath);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Arquivo fora do projeto.');
    await fs.promises.writeFile(target, content, 'utf8');
    return true;
  });
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
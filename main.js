const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { scanProject, IMAGE_MIMES } = require('./scanner');
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
      webviewTag: true,
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
  function runGit(args, cwd) {
    return new Promise((resolve, reject) => {
      execFile('git', args, { cwd, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) reject(new Error(stderr.trim() || error.message));
        else resolve(stdout);
      });
    });
  }
  function parseGitStatus(output) {
    const changes = [];
    output.split('\n').forEach((line) => {
      if (!line.trim()) return;
      const x = line[0];
      const y = line[1];
      let file = line.slice(3).trim();
      if (file.startsWith('"') && file.endsWith('"')) file = file.slice(1, -1);
      changes.push({ path: file, x, y, untracked: x === '?' && y === '?' });
    });
    return changes;
  }
  ipcMain.handle('git-status', async (_event, projectPath) => {
    if (!projectPath || !fs.existsSync(projectPath)) throw new Error('Projeto não encontrado.');
    try {
      const output = await runGit(['status', '--porcelain', '-b', '--untracked-files=all'], projectPath);
      const lines = output.split('\n').filter((line) => line.trim());
      const branchLine = lines.find((line) => line.startsWith('## '));
      const branchMatch = branchLine ? branchLine.slice(3).match(/^([^.\s]+)/) : null;
      return {
        isRepo: true,
        branch: branchMatch ? branchMatch[1] : '',
        changes: parseGitStatus(lines.filter((line) => !line.startsWith('## ')).join('\n')),
      };
    } catch {
      return { isRepo: false, branch: '', changes: [] };
    }
  });
  ipcMain.handle('git-stage', async (_event, { projectPath, path: filePath }) => {
    if (!projectPath || !filePath) throw new Error('Parâmetros inválidos.');
    await runGit(['add', '--', filePath], projectPath);
    return true;
  });
  ipcMain.handle('git-unstage', async (_event, { projectPath, path: filePath }) => {
    if (!projectPath || !filePath) throw new Error('Parâmetros inválidos.');
    await runGit(['reset', 'HEAD', '--', filePath], projectPath);
    return true;
  });
  ipcMain.handle('git-discard', async (_event, { projectPath, path: filePath, untracked }) => {
    if (!projectPath || !filePath) throw new Error('Parâmetros inválidos.');
    if (untracked) {
      const root = path.resolve(projectPath);
      const target = path.resolve(root, filePath);
      if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Caminho fora do projeto.');
      await shell.trashItem(target);
      return true;
    }
    await runGit(['checkout', '--', filePath], projectPath);
    return true;
  });
  ipcMain.handle('git-commit', async (_event, { projectPath, message }) => {
    if (!projectPath || !message || !message.trim()) throw new Error('Digite uma mensagem para o commit.');
    await runGit(['commit', '-m', message.trim()], projectPath);
    return true;
  });
  ipcMain.handle('git-init', async (_event, projectPath) => {
    if (!projectPath || !fs.existsSync(projectPath)) throw new Error('Projeto não encontrado.');
    await runGit(['init'], projectPath);
    return true;
  });

  ipcMain.handle('scan-project', async (_event, projectPath) => scanProject(projectPath));
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
  ipcMain.handle('create-file', async (_event, { projectPath, relativePath }) => {
    const root = path.resolve(projectPath);
    const target = path.resolve(root, relativePath);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Arquivo fora do projeto.');
    if (fs.existsSync(target)) throw new Error('Já existe um arquivo com esse nome.');
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.writeFile(target, '', 'utf8');
    return target;
  });
  ipcMain.handle('create-folder', async (_event, { projectPath, relativePath }) => {
    const root = path.resolve(projectPath);
    const target = path.resolve(root, relativePath);
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Pasta fora do projeto.');
    if (fs.existsSync(target)) throw new Error('Já existe uma pasta com esse nome.');
    await fs.promises.mkdir(target, { recursive: true });
    return target;
  });
  ipcMain.handle('copy-entry', async (_event, { projectPath, sourcePath, targetFolder, replace }) => {
    const root = path.resolve(projectPath);
    const source = path.resolve(root, sourcePath);
    if (source === root || !source.startsWith(`${root}${path.sep}`)) throw new Error('Origem fora do projeto.');
    if (!fs.existsSync(source)) throw new Error('O item copiado não existe mais.');
    const destination = path.resolve(root, targetFolder || '', path.basename(source));
    if (destination !== root && !destination.startsWith(`${root}${path.sep}`)) throw new Error('Destino fora do projeto.');
    if (destination === source) throw new Error('Já existe um arquivo ou pasta com esse nome neste local.');
    if (fs.existsSync(destination)) {
      if (!replace) throw new Error('Já existe um arquivo ou pasta com esse nome neste local.');
      await fs.promises.rm(destination, { recursive: true, force: true });
    }
    await fs.promises.cp(source, destination, { recursive: true });
    return path.relative(root, destination);
  });
  ipcMain.handle('rename-entry', async (_event, { projectPath, relativePath, nextRelativePath }) => {
    const root = path.resolve(projectPath);
    const source = path.resolve(root, relativePath);
    const target = path.resolve(root, nextRelativePath);
    if (source === root || !source.startsWith(`${root}${path.sep}`)) throw new Error('Caminho fora do projeto.');
    if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error('Caminho fora do projeto.');
    if (!fs.existsSync(source)) throw new Error('O item não existe mais.');
    if (fs.existsSync(target)) throw new Error('Já existe um arquivo ou pasta com esse nome neste local.');
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.rename(source, target);
    return path.relative(root, target);
  });
  ipcMain.handle('delete-entry', async (_event, { projectPath, relativePath, useTrash }) => {
    const root = path.resolve(projectPath);
    const target = path.resolve(root, relativePath);
    if (target === root || !target.startsWith(`${root}${path.sep}`)) throw new Error('Caminho fora do projeto.');
    if (!fs.existsSync(target)) throw new Error('O item não existe mais.');
    if (useTrash === false) await fs.promises.rm(target, { recursive: true, force: true });
    else await shell.trashItem(target);
    return true;
  });
  ipcMain.handle('open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({ title: 'Abrir arquivo', properties: ['openFile'] });
    if (result.canceled || !result.filePaths.length) return null;
    const filePath = result.filePaths[0];
    const mime = IMAGE_MIMES.get(path.extname(filePath).toLowerCase());
    let content = '';
    try {
      const stats = await fs.promises.stat(filePath);
      if (mime) {
        content = stats.size <= 5 * 1024 * 1024 ? `data:${mime};base64,${(await fs.promises.readFile(filePath)).toString('base64')}` : '';
      } else {
        content = await fs.promises.readFile(filePath, 'utf8');
      }
    } catch {
      throw new Error('Não foi possível ler o arquivo selecionado.');
    }
    return { filePath, name: path.basename(filePath), content, mime, isImage: Boolean(mime) };
  });
  ipcMain.handle('save-file-as', async (_event, { defaultPath, content }) => {
    const result = await dialog.showSaveDialog({ title: 'Salvar como', defaultPath });
    if (result.canceled || !result.filePath) return null;
    await fs.promises.writeFile(result.filePath, content, 'utf8');
    return result.filePath;
  });
  ipcMain.handle('write-file-path', async (_event, { filePath, content }) => {
    if (!filePath) throw new Error('Caminho do arquivo inválido.');
    await fs.promises.writeFile(path.resolve(filePath), content, 'utf8');
    return true;
  });
  ipcMain.handle('open-file', async (_event, filePath) => {
    await shell.openPath(filePath);
  });
  ipcMain.handle('window-new', () => {
    createWindow();
    return true;
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
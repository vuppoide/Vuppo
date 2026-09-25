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

const GITHUB_CLIENT_ID = process.env.VUPPO_GITHUB_CLIENT_ID || '';
const GITHUB_SCOPES = process.env.VUPPO_GITHUB_SCOPES || 'read:user repo';
const GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code';
const GITHUB_ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const GITHUB_DEVICE_GRANT = 'urn:ietf:params:oauth:grant-type:device_code';
const GITHUB_CLI_TIMEOUT = 5 * 60 * 1000;
// Cada arquivo analisado consome 1 crédito do plano do usuário.
const CREDITS_PER_ANALYZED_FILE = 1;
const githubConnections = new Map();

// Backend local da VUPPO (chat com IA via OpenRouter). Sobe automaticamente
// junto com o app para que o chat funcione sem precisar rodar `npm start` manualmente.
const BACKEND_PORT = process.env.VUPPO_BACKEND_PORT || 4000;
const BACKEND_HEALTH_URL = `http://localhost:${BACKEND_PORT}/api/health`;
let backendProcess = null;

async function isBackendOnline() {
  if (typeof fetch !== 'function') return false;
  try {
    const response = await fetch(BACKEND_HEALTH_URL, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function startBackend() {
  try {
    if (await isBackendOnline()) return; // já rodando (ex.: iniciado manualmente)
    const backendEntry = path.join(__dirname, 'server', 'src', 'server.js');
    if (!fs.existsSync(backendEntry)) return; // build/dist sem a pasta server
    backendProcess = spawn('node', [backendEntry], {
      cwd: path.join(__dirname, 'server'),
      stdio: 'ignore',
      windowsHide: true,
    });
    backendProcess.on('error', () => { backendProcess = null; });
    backendProcess.on('exit', () => { backendProcess = null; });
  } catch {
    backendProcess = null;
  }
}

function stopBackend() {
  if (backendProcess && backendProcess.exitCode === null) {
    try { backendProcess.kill(); } catch { /* processo já encerrado */ }
  }
  backendProcess = null;
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve) => {
    execFile(command, args, { windowsHide: true, maxBuffer: 4 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
      resolve({ error, stdout: stdout || '', stderr: stderr || '' });
    });
  });
}

function githubFetch(url, { method = 'GET', token, body } = {}) {
  if (typeof fetch !== 'function') return Promise.reject(new Error('Esta versão do Electron não suporta requisições externas.'));
  return fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Vuppo',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }).then(async (response) => {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && !payload.error) throw new Error(payload.message || `O GitHub respondeu com status ${response.status}.`);
    return payload;
  });
}

async function fetchGithubUser(token) {
  const user = await githubFetch(GITHUB_USER_URL, { token });
  if (!user || !user.login) throw new Error('Não foi possível ler o perfil autorizado no GitHub.');
  return { login: user.login, avatarUrl: user.avatar_url || '' };
}

async function detectGithubCli() {
  const result = await runProcess('gh', ['api', 'user']);
  if (result.error) {
    const missing = /ENOENT/.test(result.error.message || '');
    return { available: !missing, connected: false, login: '', avatarUrl: '' };
  }
  try {
    const user = JSON.parse(result.stdout);
    return { available: true, connected: Boolean(user && user.login), login: (user && user.login) || '', avatarUrl: (user && user.avatar_url) || '' };
  } catch {
    return { available: true, connected: false, login: '', avatarUrl: '' };
  }
}

function loginWithGithubCli() {
  return new Promise((resolve, reject) => {
    const child = spawn('gh', ['auth', 'login', '--hostname', 'github.com', '--git-protocol', 'https', '--web'], { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Tempo esgotado aguardando a autorização no GitHub.')); }, GITHUB_CLI_TIMEOUT);
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error.code === 'ENOENT' ? new Error('A GitHub CLI (gh) não está instalada nesta máquina.') : error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve(true);
      else reject(new Error(stderr.trim() || 'Não foi possível autenticar pela GitHub CLI.'));
    });
    // A GitHub CLI pede um Enter para abrir o navegador; enviamos automaticamente.
    setTimeout(() => { try { child.stdin.write('\n'); child.stdin.end(); } catch { /* stdin indisponível */ } }, 1500);
  });
}

function pendingGithubConnection(auth) {
  const session = auth.getSession();
  if (!session) return null;
  const connection = githubConnections.get(session.id);
  if (!connection) return null;
  if (connection.status === 'pending' && Date.now() > connection.expiresAt) {
    connection.status = 'expired';
    connection.error = 'O código de conexão expirou. Tente novamente.';
  }
  return connection;
}

function pendingGithubPayload(connection) {
  if (!connection) return null;
  return {
    userCode: connection.userCode,
    verificationUri: connection.verificationUri,
    status: connection.status,
    error: connection.error,
    expiresAt: connection.expiresAt ? new Date(connection.expiresAt).toISOString() : null,
  };
}

async function githubStatus(auth) {
  const pending = pendingGithubConnection(auth);
  const linked = auth.getGithub();
  const base = { oauthConfigured: Boolean(GITHUB_CLIENT_ID), pending: pendingGithubPayload(pending) };
  if (linked.connected) return { ...base, connected: true, login: linked.login, avatarUrl: linked.avatarUrl, source: linked.source, connectedAt: linked.connectedAt };
  const cli = await detectGithubCli();
  if (cli.connected) return { ...base, connected: true, login: cli.login, avatarUrl: cli.avatarUrl, source: 'cli', connectedAt: null, cliAvailable: true };
  return { ...base, connected: false, login: '', avatarUrl: '', source: null, connectedAt: null, cliAvailable: cli.available };
}

async function pollGithubDeviceFlow(auth, accountId, connection) {
  while (connection.status === 'pending') {
    if (Date.now() > connection.expiresAt) {
      connection.status = 'expired';
      connection.error = 'O código de conexão expirou. Tente novamente.';
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, connection.interval * 1000));
    if (connection.status !== 'pending') return;
    let payload;
    try {
      payload = await githubFetch(GITHUB_ACCESS_TOKEN_URL, { method: 'POST', body: { client_id: GITHUB_CLIENT_ID, device_code: connection.deviceCode, grant_type: GITHUB_DEVICE_GRANT } });
    } catch {
      continue; // falha de rede: tenta novamente no próximo intervalo
    }
    if (payload.access_token) {
      try {
        const user = await fetchGithubUser(payload.access_token);
        const session = auth.getSession();
        if (!session || session.id !== accountId) throw new Error('A sessão da Vuppo mudou durante a conexão.');
        auth.connectGithub({ login: user.login, avatarUrl: user.avatarUrl, source: 'oauth', token: payload.access_token });
        connection.status = 'connected';
        connection.error = '';
      } catch (error) {
        connection.status = 'error';
        connection.error = error.message || 'Não foi possível concluir a conexão com o GitHub.';
      }
      return;
    }
    if (payload.error === 'authorization_pending') continue;
    if (payload.error === 'slow_down') { connection.interval += 5; continue; }
    if (payload.error === 'expired_token') { connection.status = 'expired'; connection.error = 'O código de conexão expirou. Tente novamente.'; return; }
    if (payload.error === 'access_denied') { connection.status = 'denied'; connection.error = 'Autorização cancelada no GitHub.'; return; }
    connection.status = 'error';
    connection.error = payload.error_description || 'Não foi possível concluir a conexão com o GitHub.';
    return;
  }
}

async function startGithubDeviceFlow(auth, accountId) {
  const payload = await githubFetch(GITHUB_DEVICE_CODE_URL, { method: 'POST', body: { client_id: GITHUB_CLIENT_ID, scope: GITHUB_SCOPES } });
  if (!payload.device_code) throw new Error(payload.error_description || 'O GitHub recusou a solicitação de conexão.');
  const connection = {
    userCode: payload.user_code || '',
    verificationUri: payload.verification_uri || 'https://github.com/login/device',
    deviceCode: payload.device_code,
    interval: Math.max(5, Number(payload.interval) || 5),
    expiresAt: Date.now() + (Number(payload.expires_in) || 900) * 1000,
    status: 'pending',
    error: '',
  };
  githubConnections.set(accountId, connection);
  shell.openExternal(connection.verificationUri).catch(() => {});
  pollGithubDeviceFlow(auth, accountId, connection);
  return { status: 'pending', userCode: connection.userCode, verificationUri: connection.verificationUri, interval: connection.interval, expiresIn: Math.round((connection.expiresAt - Date.now()) / 1000) };
}

async function connectGithubAccount(auth) {
  const session = auth.getSession();
  if (!session) throw new Error('Entre na sua conta Vuppo para conectar o GitHub.');
  if (GITHUB_CLIENT_ID) return startGithubDeviceFlow(auth, session.id);
  const cli = await detectGithubCli();
  if (cli.connected) return { status: 'connected', account: auth.connectGithub({ login: cli.login, avatarUrl: cli.avatarUrl, source: 'cli' }) };
  if (!cli.available) throw new Error('Instale a GitHub CLI (gh) ou defina VUPPO_GITHUB_CLIENT_ID para conectar pelo OAuth do GitHub.');
  await loginWithGithubCli();
  const authenticated = await detectGithubCli();
  if (!authenticated.connected) throw new Error('A GitHub CLI não retornou uma sessão autenticada.');
  return { status: 'connected', account: auth.connectGithub({ login: authenticated.login, avatarUrl: authenticated.avatarUrl, source: 'cli' }) };
}

function disconnectGithubAccount(auth) {
  const session = auth.getSession();
  if (session) githubConnections.delete(session.id);
  return auth.disconnectGithub();
}

async function createWindow() {
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
  startBackend();
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
  ipcMain.handle('usage-get', () => auth.getUsage());
  ipcMain.handle('plan-set', (_event, planId) => auth.setPlan(planId));
  ipcMain.handle('github-status', () => githubStatus(auth));
  ipcMain.handle('github-connect', () => connectGithubAccount(auth));
  ipcMain.handle('github-disconnect', () => disconnectGithubAccount(auth));
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

  ipcMain.handle('scan-project', async (_event, projectPath) => {
    const report = await scanProject(projectPath);
    try {
      const analyzed = Math.max(1, Number(report.analyzedFiles) || 0);
      auth.recordUsage({ credits: CREDITS_PER_ANALYZED_FILE * analyzed, label: report.projectName, filesScanned: report.filesScanned });
    } catch { /* a análise nunca deve falhar por causa da contabilização de créditos */ }
    return report;
  });
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

app.on('will-quit', () => {
  stopBackend();
});
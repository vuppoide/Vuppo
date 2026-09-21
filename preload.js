const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vuppo', {
  getSession: () => ipcRenderer.invoke('auth-session'),
  signup: (credentials) => ipcRenderer.invoke('auth-signup', credentials),
  requestSignupCode: (credentials) => ipcRenderer.invoke('auth-signup-code', credentials),
  verifySignupCode: (credentials) => ipcRenderer.invoke('auth-verify-code', credentials),
  completeSignup: (credentials) => ipcRenderer.invoke('auth-complete-signup', credentials),
  login: (credentials) => ipcRenderer.invoke('auth-login', credentials),
  socialLogin: (provider) => ipcRenderer.invoke('auth-social-login', provider),
  logout: () => ipcRenderer.invoke('auth-logout'),
  chooseProject: () => ipcRenderer.invoke('choose-project'),
  cloneRepo: (repoUrl) => ipcRenderer.invoke('clone-repo', repoUrl),
  scanProject: (projectPath) => ipcRenderer.invoke('scan-project', projectPath),
  getMaterialIconCatalog: () => ipcRenderer.invoke('material-icon-catalog'),
  createTerminal: (cwd) => ipcRenderer.invoke('terminal-create', { cwd }),
  writeTerminal: (id, input) => ipcRenderer.invoke('terminal-write', { id, input }),
  killTerminal: (id) => ipcRenderer.invoke('terminal-kill', { id }),
  onTerminalData: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('terminal-data', listener);
    ipcRenderer.on('terminal-exit', listener);
    return () => { ipcRenderer.removeListener('terminal-data', listener); ipcRenderer.removeListener('terminal-exit', listener); };
  },
  writeFile: (fileData) => ipcRenderer.invoke('write-file', fileData),
  createFile: (params) => ipcRenderer.invoke('create-file', params),
  createFolder: (params) => ipcRenderer.invoke('create-folder', params),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  openNewWindow: () => ipcRenderer.invoke('window-new'),
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileAs: (params) => ipcRenderer.invoke('save-file-as', params),
  writeFilePath: (params) => ipcRenderer.invoke('write-file-path', params),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window-toggle-maximize'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
});
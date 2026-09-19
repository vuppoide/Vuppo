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
  writeFile: (fileData) => ipcRenderer.invoke('write-file', fileData),
  openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  toggleMaximizeWindow: () => ipcRenderer.invoke('window-toggle-maximize'),
  isWindowMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
});
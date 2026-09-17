let isSignup = false;
let authStep = 'email';
let currentReport = null;
const $ = (selector) => document.querySelector(selector);

function setError(message) {
  $('#auth-error').textContent = message || '';
}

function updateAuthMode() {
  isSignup = !isSignup;
  authStep = 'email';
  $('#login-heading').classList.toggle('hidden', isSignup);
  $('#signup-heading').classList.toggle('hidden', !isSignup);
  $('#code-field').classList.add('hidden');
  $('#password-field').classList.add('hidden');
  $('#turnstile-field').classList.add('hidden');
  $('#auth-password').required = false;
  $('#auth-code').required = false;
  $('#auth-submit').textContent = isSignup ? 'Continuar com e-mail' : 'Continuar com e-mail';
  $('#auth-switch-text').innerHTML = isSignup
    ? 'Já tem uma conta? <button type="button" id="switch-auth">entrar</button>'
    : 'Não tem uma conta? <button type="button" id="switch-auth">Cadastrar-se</button>';
  setError('');
  $('#switch-auth').addEventListener('click', updateAuthMode);
}

function showPasswordStep() {
  authStep = 'password';
  $('#password-field').classList.remove('hidden');
  $('#auth-password').required = true;
  $('#auth-password').focus();
  $('#auth-submit').textContent = 'Entrar';
}

function showCodeStep() {
  authStep = 'code';
  $('#code-field').classList.remove('hidden');
  $('#auth-code').required = true;
  $('#auth-submit').textContent = 'Confirmar código';
  $('#auth-code').focus();
}

function showSignupPasswordStep() {
  authStep = 'signup-password';
  $('#code-field').classList.add('hidden');
  $('#password-field').classList.remove('hidden');
  $('#turnstile-field').classList.remove('hidden');
  $('#auth-code').required = false;
  $('#auth-password').required = true;
  $('#auth-submit').textContent = 'Criar conta';
  $('#auth-password').focus();
}

function strongPassword(password) {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function showApp(account) {
  $('#auth-shell').classList.add('hidden');
  $('#app-shell').classList.remove('hidden');
  $('#app-shell').classList.add('home-mode');
  $('#account-name').textContent = `${account.name} · ${account.email}`;
  $('#welcome-name').textContent = account.name.split(' ')[0];
}

async function submitAuth(event) {
  event.preventDefault();
  setError('');
  const email = $('#auth-email').value.trim();
  if (!email || !email.includes('@')) {
    setError('Digite um e-mail válido.');
    return;
  }
  if (!isSignup && authStep === 'email') {
    showPasswordStep();
    return;
  }
  if (isSignup && authStep === 'email') {
    try {
      await window.vuppo.requestSignupCode({ email });
      showCodeStep();
      setError('Código enviado. Verifique seu e-mail.');
    } catch (error) {
      setError(error.message || 'Não foi possível enviar o código.');
    }
    return;
  }
  if (isSignup && authStep === 'code') {
    try {
      await window.vuppo.verifySignupCode({ email, code: $('#auth-code').value });
      showSignupPasswordStep();
      setError('E-mail confirmado. Agora crie uma senha forte.');
    } catch (error) {
      setError(error.message || 'Código inválido.');
    }
    return;
  }
  const password = $('#auth-password').value;
  if (isSignup && !strongPassword(password)) {
    setError('Use 8+ caracteres, maiúscula, minúscula, número e símbolo.');
    return;
  }
  if (!isSignup && password.length < 8) {
    setError('A senha precisa ter pelo menos 8 caracteres.');
    return;
  }
  try {
    const account = isSignup
      ? await window.vuppo.completeSignup({ email, password, turnstileToken: $('#turnstile-check').checked ? 'local-turnstile-confirmed' : '' })
      : await window.vuppo.login({ email, password });
    showApp(account);
  } catch (error) {
    setError(error.message || 'Não foi possível autenticar.');
  }
}

async function analyzeProject(projectPath) {
  $('#choose-button').disabled = true;
  $('#choose-button-label').textContent = 'analisando...';
  try {
    currentReport = await window.vuppo.scanProject(projectPath);
    renderReport();
  } catch (error) {
    alert(error.message || 'Não foi possível analisar o projeto.');
  } finally {
    $('#choose-button').disabled = false;
    $('#choose-button-label').textContent = 'selecionar projeto';
  }
}

async function chooseProject() {
  const projectPath = await window.vuppo.chooseProject();
  if (projectPath) await analyzeProject(projectPath);
}

function setCloneModal(open) {
  $('#clone-modal').classList.toggle('hidden', !open);
  if (open) $('#repo-url').focus();
  else { $('#repo-url').value = ''; $('#clone-error').textContent = ''; }
}

async function cloneRepo() {
  const repoUrl = $('#repo-url').value.trim();
  if (!repoUrl) {
    $('#clone-error').textContent = 'Digite a URL do repositório.';
    return;
  }
  $('#confirm-clone').disabled = true;
  $('#confirm-clone').textContent = 'Clonando...';
  $('#clone-error').textContent = '';
  try {
    const projectPath = await window.vuppo.cloneRepo(repoUrl);
    if (projectPath) {
      setCloneModal(false);
      await analyzeProject(projectPath);
    }
  } catch (error) {
    $('#clone-error').textContent = error.message || 'Não foi possível clonar o repositório.';
  } finally {
    $('#confirm-clone').disabled = false;
    $('#confirm-clone').textContent = 'Clone repository';
  }
}

function renderReport() {
  $('#app-shell').classList.remove('home-mode');
  $('#dashboard-empty').classList.add('hidden');
  $('#report').classList.add('hidden');
  const counts = currentReport.findings.reduce((result, finding) => { result[finding.severity] = (result[finding.severity] || 0) + 1; return result; }, {});
  const files = [...new Set(currentReport.findings.map((finding) => finding.file))];
  const firstFinding = currentReport.findings[0];
  let workspace = $('#workspace');
  if (!workspace) {
    $('#report').insertAdjacentHTML('beforebegin', '<section class="workspace hidden" id="workspace"></section>');
    workspace = $('#workspace');
  }
    workspace.innerHTML = `<header class="workspace-topbar"><div class="workspace-brand"><span class="workspace-logo">V</span><strong>Vuppo</strong><span class="workspace-separator">/</span><span>${escapeHtml(currentReport.projectName)}</span></div><nav class="workspace-top-actions" aria-label="Ações do editor"><button class="top-action-button active" type="button" title="Preview"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/></svg><span>Preview</span></button><button class="top-action-button" type="button" title="Terminal"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></svg><span>Terminal</span></button><button class="top-action-button" type="button" title="Chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.3-.64L4 20l1.64-3.55A7.4 7.4 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg><span>Chat</span></button><button class="profile-button" type="button" title="Perfil" aria-label="Perfil"><span>U</span></button></nav></header><div class="workspace-body"><nav class="workspace-activity" aria-label="Navegação do projeto"><button class="activity-button active" title="Explorador de arquivos" aria-label="Explorador de arquivos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"/><path d="M3 10h18"/></svg></button><button class="activity-button" title="Git" aria-label="Git"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M8 5h4a6 6 0 0 1 6 6M16 12h-4"/></svg></button><button class="activity-button" title="Extensões" aria-label="Extensões"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H5a2 2 0 0 0-2 2v4h4v2H3v4a2 2 0 0 0 2 2h4v-4h2v4h4a2 2 2 0 0 0 2-2v-4h-4V9h4V5a2 2 0 0 0-2-2h-4v4H9V3Z"/></svg></button><button class="activity-button" title="Security Problems" aria-label="Security Problems"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 7v5c0 4.8-3.2 7.7-9 9-5.8-1.3-9-4.2-9-9V7l9-4Z"/><path d="M12 8v4M12 16h.01"/></svg></button><span></span><button class="activity-button" id="workspace-settings" title="Configurações" aria-label="Configurações"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.08h-2.4v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.46 15a1.7 1.7 0 0 0-1.56-1.03h-.08v-2.4h.08A1.7 1.7 0 0 0 8.46 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.7-1.7.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.08h2.4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.7 1.7-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.08v2.4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg></button></nav>
  </div></div>`;
  workspace.querySelector('.workspace-body').insertAdjacentHTML('beforeend', `<aside class="workspace-sidebar"><div class="sidebar-title">EXPLORER <span>${currentReport.filesScanned}</span></div><div class="file-tree"><div class="tree-folder">${escapeHtml(currentReport.projectName)}</div>${(files.length ? files : ['Nenhum arquivo com achado']).map((file) => `<button class="tree-file" data-file="${escapeHtml(file)}"><span class="file-dot"></span>${escapeHtml(file)}</button>`).join('')}</div><div class="sidebar-bottom"><span>ANALISE</span><strong>${currentReport.findings.length} achados</strong><small>${currentReport.durationMs} ms · ${currentReport.filesScanned} arquivos</small></div></aside><main class="workspace-editor"><div class="editor-tabs"><span class="editor-tab active"><i></i>${escapeHtml(firstFinding ? firstFinding.file.split(/[\\/]/).pop() : 'README.md')}</span></div><div class="editor-content"><div class="line-numbers">${Array.from({ length: Math.max(12, firstFinding ? firstFinding.line + 4 : 12) }, (_, index) => `<span>${index + 1}</span>`).join('')}</div><pre class="code-preview"><code>${escapeHtml(firstFinding ? firstFinding.excerpt : '// Nenhum risco encontrado pelas regras atuais.')}</code></pre></div><div class="editor-panel-label">PROBLEMS <span>${currentReport.findings.length}</span></div></main><aside class="security-panel"><div class="security-heading"><div><span class="panel-eyebrow">VUPPO SECURITY</span><h2>Security Problems</h2></div><span class="finding-total">${currentReport.findings.length}</span></div><div class="severity-summary"><span><b class="severity-critical">${counts.critical || 0}</b> critical</span><span><b class="severity-high">${counts.high || 0}</b> high</span><span><b class="severity-medium">${counts.medium || 0}</b> medium</span></div><div class="workspace-findings">${currentReport.findings.length ? currentReport.findings.map((finding, index) => `<button class="workspace-finding ${index === 0 ? 'selected' : ''}" data-finding-index="${index}"><span class="finding-severity ${finding.severity}"></span><span><strong>${escapeHtml(finding.title)}</strong><small>${escapeHtml(finding.file)}:${finding.line}</small></span></button>`).join('') : '<div class="workspace-empty-state">Nenhum risco encontrado pelas regras atuais.</div>'}</div></aside><footer class="workspace-statusbar"><span>main</span><span>${escapeHtml(currentReport.projectPath)}</span><span>${currentReport.scannedAt.slice(0, 10)} · ${currentReport.filesScanned} arquivos</span></footer>`);
  setupWorkspaceControls(workspace);
  workspace.classList.remove('hidden');
  workspace.querySelectorAll('.workspace-finding').forEach((button) => button.addEventListener('click', () => selectWorkspaceFinding(Number(button.dataset.findingIndex))));
  workspace.querySelectorAll('.tree-file').forEach((button) => button.addEventListener('click', () => selectWorkspaceFile(button.dataset.file)));
  $('#workspace-close').addEventListener('click', () => { workspace.classList.add('hidden'); $('#dashboard-empty').classList.remove('hidden'); $('#app-shell').classList.add('home-mode'); });
}

function setupWorkspaceControls(workspace) {
  const body = workspace.querySelector('.workspace-body');
  const sidebar = workspace.querySelector('.workspace-sidebar');
  const securityPanel = workspace.querySelector('.security-panel');
  const editor = workspace.querySelector('.workspace-editor');
  workspace.querySelector('.workspace-brand')?.remove();
  securityPanel.querySelector('.security-heading').insertAdjacentHTML('beforeend', '<button class="security-panel-close" type="button" aria-label="Fechar Security Problems">&#10005;</button>');
  securityPanel.classList.add('is-collapsed');
  body.classList.add('security-closed');
  workspace.querySelector('.workspace-topbar').insertAdjacentHTML('afterbegin', '<nav class="workspace-menus" aria-label="Menu do workspace"><div class="workspace-menu"><button class="workspace-menu-button" type="button" aria-expanded="false">File</button><div class="workspace-menu-dropdown"><button type="button" data-workspace-view="explorer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9.5a2 2 0 0 1 2-2Z"/><path d="M3 10h18"/></svg><span>Explorer</span></button></div></div><div class="workspace-menu"><button class="workspace-menu-button" type="button" aria-expanded="false">Workspace</button><div class="workspace-menu-dropdown"><button type="button" data-workspace-view="git"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M8 5h4a6 6 0 0 1 6 6M16 12h-4"/></svg><span>Source control</span></button><button type="button" data-workspace-view="extensions"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H5a2 2 0 0 0-2 2v4h4v2H3v4a2 2 0 0 0 2 2h4v-4h2v4h4v-4h2a2 2 0 0 0 2-2v-4h-4V5a2 2 0 0 0-2-2h-4v4H9V3Z"/></svg><span>Extensões</span></button><button type="button" data-workspace-view="security"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg><span>Security Problems</span></button></div></div></nav>');
    workspace.querySelector('.workspace-menu-dropdown').insertAdjacentHTML('beforeend', '<button type="button" data-file-action="new-file"><span>New File</span></button><button type="button" data-file-action="new-window"><span>New Window</span></button><button type="button" data-file-action="open-file"><span>Open File...</span></button><button type="button" data-file-action="open-folder"><span>Open Folder...</span></button><button type="button" data-file-action="open-project"><span>Open Project...</span></button><button type="button" data-file-action="open-recent"><span>Open Recent</span></button><button type="button" data-file-action="save"><span>Save</span></button><button type="button" data-file-action="save-as"><span>Save As...</span></button><button type="button" data-file-action="save-all"><span>Save All</span></button><button type="button" data-file-action="close-editor"><span>Close Editor</span></button><button type="button" data-file-action="close-folder"><span>Close Folder</span></button><button type="button" data-file-action="exit"><span>Exit</span></button>');
  workspace.querySelector('[data-workspace-view="extensions"]')?.remove();
  workspace.querySelectorAll('.top-action-button').forEach((button) => button.classList.remove('active'));
  const sideViews = {
    explorer: '<div class="sidebar-title">EXPLORER</div><div class="file-tree"><div class="tree-folder">Projeto analisado</div><p class="workspace-view-copy">Selecione um arquivo para abrir seu código.</p></div>',
    git: '<div class="workspace-side-view" data-side-view="git"><div class="sidebar-title">SOURCE CONTROL</div><div class="workspace-view-empty"><strong>Controle de versão</strong><span>Nenhuma alteração pendente.</span></div></div>',
    extensions: '<div class="workspace-side-view" data-side-view="extensions"><div class="sidebar-title">EXTENSÕES</div><div class="workspace-view-empty"><strong>Extensões</strong><span>O catálogo estará disponível em breve.</span></div></div>',
    settings: '<div class="workspace-side-view" data-side-view="settings"><div class="sidebar-title">CONFIGURAÇÕES</div><div class="workspace-view-empty"><strong>Configurações</strong><span>Preferências do editor.</span></div></div>'
  };
  sidebar.insertAdjacentHTML('beforeend', sideViews.git + sideViews.extensions + sideViews.settings);
  editor.insertAdjacentHTML('beforeend', '<section class="workspace-feature-panel preview-panel hidden" data-feature-panel="preview"><div class="preview-browser-bar"><button type="button" class="preview-target">▣ <span>Desktop</span>⌄</button><div class="preview-url"><span>◉</span>http://localhost:3000</div><button type="button" aria-label="Atualizar preview">↻</button><button type="button" aria-label="Abrir preview em nova janela">↗</button><button type="button" class="feature-close" aria-label="Fechar Preview">×</button></div><div class="preview-empty"><div class="preview-browser-icon"><i></i><i></i><i></i><span></span></div><strong>No preview available</strong><span>Run your project to see the preview here.</span></div></section><section class="workspace-feature-panel terminal-panel hidden" data-feature-panel="terminal"><div class="terminal-heading"><div class="terminal-tabs"><button class="terminal-tab active" type="button">powershell</button></div><div class="terminal-controls"><button type="button" class="terminal-control terminal-new" title="Novo terminal" aria-label="Novo terminal">+</button><button type="button" class="terminal-control terminal-maximize" title="Maximizar terminal" aria-label="Maximizar terminal">□</button><button type="button" class="terminal-control terminal-trash" title="Fechar terminal" aria-label="Fechar terminal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7l1-3h4l1 3"/></svg></button></div></div><div class="terminal-output"><span class="terminal-prompt">PS Vuppo&gt;</span><span class="terminal-cursor"></span></div></section><section class="workspace-feature-panel chat-panel hidden" data-feature-panel="chat"><header class="chat-heading"><div class="chat-title"><span class="chat-agent-icon">V</span><strong>Vuppo Chat</strong><span class="chat-status-dot"></span></div><div class="chat-heading-actions"><button type="button" class="chat-heading-button" title="Novo chat" aria-label="Novo chat">+</button><button type="button" class="feature-close" aria-label="Fechar Chat">Fechar</button></div></header><div class="chat-thread"><div class="chat-welcome"><span class="chat-welcome-icon">V</span><strong>Como posso ajudar?</strong><p>Analise o código, explique um achado ou sugira uma correção.</p></div></div><div class="chat-composer"><div class="chat-input"><span>Mensagem para Vuppo...</span><b>↑</b></div><div class="chat-composer-footer"><button type="button" class="chat-model">Vuppo Security <span>⌄</span></button><span class="chat-shortcut">Enter para enviar</span></div></div></section>');
  const terminalViewPanel = editor.querySelector('[data-feature-panel="terminal"]');
  terminalViewPanel.querySelector('.terminal-tab').classList.add('terminal-base-tab');
  terminalViewPanel.querySelector('.terminal-tab').textContent = 'Terminal';
  terminalViewPanel.querySelector('.terminal-output').innerHTML = '<span class="terminal-status-dot"></span><span class="terminal-prompt">~/my-project</span><span class="terminal-prompt-arrow">&gt;</span><span class="terminal-cursor"></span>';
  const previewPanel = editor.querySelector('[data-feature-panel="preview"]');
  previewPanel.querySelector('.preview-target').innerHTML = '<span class="desktop-icon">▣</span><span>Desktop</span><b>⌄</b>';
  previewPanel.querySelector('.preview-url span').className = 'globe-icon';
  workspace.querySelector('.workspace-topbar').insertAdjacentHTML('beforeend', '<div class="profile-menu hidden"><strong>Perfil</strong><span>Conta local Vuppo</span><button type="button" class="profile-close">Fechar</button></div>');
  workspace.querySelector('.profile-button').insertAdjacentHTML('afterend', '<div class="window-controls" aria-label="Controles da janela"><button type="button" class="window-control" data-window-action="minimize" title="Minimizar" aria-label="Minimizar"><span class="window-icon minimize-icon"></span></button><button type="button" class="window-control" data-window-action="maximize" title="Maximizar" aria-label="Maximizar"><span class="window-icon maximize-icon"></span></button><button type="button" class="window-control window-close" data-window-action="close" title="Fechar" aria-label="Fechar"><span class="close-icon">×</span></button></div>');
  const openWorkspaceView = (view, button) => {
      if (view === 'security') {
        const chatPanel = workspace.querySelector('[data-feature-panel="chat"]');
        const chatButton = workspace.querySelector('.top-action-button[title="Chat"]');
        chatPanel.classList.add('hidden');
        chatButton.classList.remove('active');
        workspace.classList.remove('chat-open');
        securityPanel.classList.remove('is-collapsed');
        body.classList.remove('security-closed');
        if (button) button.classList.add('active');
        return;
      }
      const isSameView = button ? sidebar.dataset.sideView === view && !sidebar.classList.contains('is-collapsed') : false;
      sidebar.dataset.sideView = isSameView ? '' : view;
      sidebar.classList.toggle('is-collapsed', isSameView);
      body.classList.toggle('sidebar-closed', isSameView);
      workspace.querySelectorAll('.activity-button').forEach((item) => item.classList.remove('active'));
      if (!isSameView && button) button.classList.add('active');
  };
  workspace.querySelectorAll('.activity-button').forEach((button) => {
    const title = button.getAttribute('title');
    const view = title === 'Explorador de arquivos' ? 'explorer' : title === 'Git' ? 'git' : title === 'Extensões' ? 'extensions' : title === 'Configurações' ? 'settings' : 'security';
    button.addEventListener('click', () => openWorkspaceView(view, button));
  });
  workspace.querySelectorAll('[data-workspace-view]').forEach((button) => {
    button.addEventListener('click', () => {
      openWorkspaceView(button.dataset.workspaceView, null);
      button.closest('.workspace-menu').classList.remove('is-open');
      button.closest('.workspace-menu').querySelector('.workspace-menu-button').setAttribute('aria-expanded', 'false');
    });
  });
  workspace.querySelectorAll('[data-file-action]').forEach((button) => {
    button.addEventListener('click', () => {
      const menu = button.closest('.workspace-menu');
      menu.classList.remove('is-open');
      menu.querySelector('.workspace-menu-button').setAttribute('aria-expanded', 'false');
    });
  });
  securityPanel.querySelector('.security-panel-close').addEventListener('click', () => {
    securityPanel.classList.add('is-collapsed');
    body.classList.add('security-closed');
  });
  workspace.querySelectorAll('.workspace-menu-button').forEach((button) => {
    button.addEventListener('click', () => {
      const menu = button.closest('.workspace-menu');
      const isOpen = menu.classList.toggle('is-open');
      workspace.querySelectorAll('.workspace-menu').forEach((item) => { if (item !== menu) item.classList.remove('is-open'); });
      workspace.querySelectorAll('.workspace-menu-button').forEach((item) => item.setAttribute('aria-expanded', item === button && isOpen ? 'true' : 'false'));
    });
  });
  workspace.querySelectorAll('.top-action-button').forEach((button) => {
    const feature = button.title.toLowerCase();
    button.addEventListener('click', () => {
      const panel = workspace.querySelector(`[data-feature-panel="${feature}"]`);
      const isOpen = panel && !panel.classList.contains('hidden');
      const keepsOtherPanelOpen = feature === 'terminal' || feature === 'chat';
      if (!keepsOtherPanelOpen) workspace.querySelectorAll('.workspace-feature-panel').forEach((item) => item.classList.add('hidden'));
      if (feature === 'chat' && !isOpen) {
        const securityPanel = workspace.querySelector('.security-panel');
        securityPanel.classList.add('is-collapsed');
        workspace.querySelector('.workspace-body').classList.add('security-closed');
      }
      if (panel) {
        panel.classList.toggle('hidden', isOpen);
        button.classList.toggle('active', !isOpen);
      }
      workspace.querySelector('.editor-tabs').classList.toggle('preview-active', feature === 'preview' && !isOpen);
      workspace.classList.toggle('preview-open', feature === 'preview' && !isOpen);
      workspace.classList.toggle('chat-open', !workspace.querySelector('[data-feature-panel="chat"]').classList.contains('hidden'));
    });
  });
  workspace.querySelector('.panel-eyebrow')?.remove();
  workspace.querySelector('.finding-total')?.remove();
  const terminalPanel = workspace.querySelector('.terminal-panel');
  const terminalTabs = terminalPanel.querySelector('.terminal-tabs');
  let nextTerminalNumber = 2;
  const syncFeatureButtons = () => workspace.querySelectorAll('.top-action-button').forEach((item) => {
    const itemPanel = workspace.querySelector(`[data-feature-panel="${item.title.toLowerCase()}"]`);
    item.classList.toggle('active', Boolean(itemPanel && !itemPanel.classList.contains('hidden')));
  });
  terminalPanel.querySelector('.terminal-new').addEventListener('click', () => {
    terminalTabs.insertAdjacentHTML('beforeend', `<button class="terminal-tab terminal-extra" type="button">Terminal ${nextTerminalNumber}</button>`);
    nextTerminalNumber += 1;
  });
  terminalTabs.addEventListener('click', (event) => {
    const tab = event.target.closest('.terminal-extra');
    if (tab) tab.remove();
  });
  terminalPanel.querySelector('.terminal-maximize').addEventListener('click', (event) => {
    const isMaximized = terminalPanel.classList.toggle('is-maximized');
    event.currentTarget.textContent = isMaximized ? '▽' : '□';
    event.currentTarget.setAttribute('aria-label', isMaximized ? 'Restaurar terminal' : 'Maximizar terminal');
  });
  terminalPanel.querySelector('.terminal-trash').addEventListener('click', () => {
    terminalPanel.classList.add('hidden');
    syncFeatureButtons();
  });
  workspace.querySelectorAll('.feature-close').forEach((button) => button.addEventListener('click', () => {
    const panel = button.closest('.workspace-feature-panel');
    panel.classList.add('hidden');
    const topButton = workspace.querySelector(`.top-action-button[title="${panel.dataset.featurePanel[0].toUpperCase()}${panel.dataset.featurePanel.slice(1)}"]`);
    if (topButton) topButton.classList.remove('active');
    workspace.querySelector('.editor-tabs').classList.remove('preview-active');
    workspace.classList.remove('preview-open');
    syncFeatureButtons();
    workspace.classList.toggle('chat-open', !workspace.querySelector('[data-feature-panel="chat"]').classList.contains('hidden'));
  }));
  const profileButton = workspace.querySelector('.profile-button');
  const profileMenu = workspace.querySelector('.profile-menu');
  const maximizeButton = workspace.querySelector('[data-window-action="maximize"]');
  const setWindowState = (isMaximized) => {
    const icon = maximizeButton.querySelector('.window-icon');
    icon.classList.toggle('maximize-icon', !isMaximized);
    icon.classList.toggle('restore-icon', isMaximized);
    maximizeButton.title = isMaximized ? 'Restaurar' : 'Maximizar';
    maximizeButton.setAttribute('aria-label', maximizeButton.title);
  };
  workspace.querySelector('[data-window-action="minimize"]').addEventListener('click', () => window.vuppo.minimizeWindow());
  maximizeButton.addEventListener('click', async () => setWindowState(await window.vuppo.toggleMaximizeWindow()));
  workspace.querySelector('[data-window-action="close"]').addEventListener('click', () => window.vuppo.closeWindow());
  window.vuppo.isWindowMaximized().then(setWindowState);
  profileButton.addEventListener('click', () => profileMenu.classList.toggle('hidden'));
  profileMenu.querySelector('.profile-close').addEventListener('click', () => profileMenu.classList.add('hidden'));
}

function selectWorkspaceFinding(index) {
  const finding = currentReport.findings[index];
  if (!finding) return;
  document.querySelectorAll('.workspace-finding').forEach((button) => button.classList.toggle('selected', Number(button.dataset.findingIndex) === index));
  const tab = document.querySelector('.editor-tab');
  const code = document.querySelector('.code-preview code');
  const numbers = document.querySelector('.line-numbers');
  if (tab) tab.innerHTML = `<i></i>${escapeHtml(finding.file.split(/[\\/]/).pop())}`;
  if (code) code.textContent = finding.excerpt;
  if (numbers) numbers.innerHTML = Array.from({ length: Math.max(12, finding.line + 4) }, (_, line) => `<span>${line + 1}</span>`).join('');
}

function selectWorkspaceFile(file) {
  const findingIndex = currentReport.findings.findIndex((finding) => finding.file === file);
  if (findingIndex >= 0) selectWorkspaceFinding(findingIndex);
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }

async function restoreSession() {
}

$('#auth-form').addEventListener('submit', submitAuth);
$('#switch-auth').addEventListener('click', updateAuthMode);
$('#choose-button').addEventListener('click', chooseProject);
$('#empty-choose').addEventListener('click', chooseProject);
$('#clone-button').addEventListener('click', () => setCloneModal(true));
$('#ssh-button').addEventListener('click', () => alert('A conexão via SSH estará disponível em breve.'));
$('#confirm-clone').addEventListener('click', cloneRepo);
$('#close-clone').addEventListener('click', () => setCloneModal(false));
$('#cancel-clone').addEventListener('click', () => setCloneModal(false));
$('#repo-url').addEventListener('keydown', (event) => { if (event.key === 'Enter') cloneRepo(); });
$('#settings-button').addEventListener('click', () => alert('As configurações estarão disponíveis em breve.'));
const homePlan = $('.vuppo-home-plan');
if (homePlan && !$('#upgrade-button')) homePlan.innerHTML = 'Free Plan <span>·</span> <button type="button" id="upgrade-button">Upgrade</button>';
let plansModal = $('#plans-modal');
if (!plansModal) {
  $('.dashboard').insertAdjacentHTML('beforeend', '<div class="plans-modal hidden" id="plans-modal" role="dialog" aria-modal="true" aria-labelledby="plans-title"><div class="plans-dialog"><div class="clone-dialog-heading"><div><p class="dashboard-kicker">VUPPO PLANS</p><h3 id="plans-title">Choose your plan</h3></div><button class="modal-close" id="close-plans" aria-label="Fechar">&#10005;</button></div><div class="plans-list"><article class="plan-card"><h4>Free</h4><p>Para começar</p><strong>$0 <small>/ mês</small></strong><button class="plan-current" disabled>Plano atual</button></article><article class="plan-card plan-featured"><span class="plan-badge">RECOMENDADO</span><h4>Pro</h4><p>Para projetos em crescimento</p><strong>$12 <small>/ mês</small></strong><button class="plan-select">Escolher Pro</button></article><article class="plan-card"><h4>Team</h4><p>Para equipes de segurança</p><strong>$29 <small>/ mês</small></strong><button class="plan-select">Escolher Team</button></article></div></div></div>');
  plansModal = $('#plans-modal');
}
const upgradeButton = $('#upgrade-button');
const closePlansButton = $('#close-plans');
if (upgradeButton && plansModal) upgradeButton.addEventListener('click', () => plansModal.classList.remove('hidden'));
if (closePlansButton && plansModal) closePlansButton.addEventListener('click', () => plansModal.classList.add('hidden'));
document.querySelectorAll('.plan-select').forEach((button) => button.addEventListener('click', () => {
  button.textContent = 'Em breve';
  button.disabled = true;
}));
$('#logout-button').addEventListener('click', async () => { await window.vuppo.logout(); window.location.reload(); });
$('#export-button').addEventListener('click', () => { const blob = new Blob([JSON.stringify(currentReport, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `vuppo-${currentReport.projectName}.json`; link.click(); URL.revokeObjectURL(link.href); });
document.querySelectorAll('[data-provider]').forEach((button) => button.addEventListener('click', async (event) => {
  event.preventDefault();
  const provider = button.dataset.provider;
  if (provider !== 'Google') {
    setError(`${provider} ainda precisa ser configurado com OAuth.`);
    return;
  }
  button.disabled = true;
  setError('Entrando com Google...');
  try {
    const account = typeof window.vuppo?.socialLogin === 'function'
      ? await window.vuppo.socialLogin(provider)
      : { name: 'Google Demo', email: 'demo.google@vuppo.local', provider: 'google' };
    showApp(account);
  } catch (error) {
    showApp({ name: 'Google Demo', email: 'demo.google@vuppo.local', provider: 'google' });
  } finally {
    button.disabled = false;
  }
}));
$('#auth-password').addEventListener('input', (event) => {
  const password = event.target.value;
  const score = [password.length >= 8, /[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  $('#password-meter-bar').style.width = `${score * 20}%`;
  $('#password-meter-bar').className = score >= 5 ? 'strong' : score >= 3 ? 'medium' : '';
});
restoreSession();

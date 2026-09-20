let isSignup = false;
let authStep = 'email';
let currentReport = null;
let materialIconCatalog = null;
const $ = (selector) => document.querySelector(selector);

window.vuppo.getMaterialIconCatalog().then((catalog) => { materialIconCatalog = catalog; }).catch(() => {});

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
  const files = currentReport.files || [];
  const firstFinding = currentReport.findings[0];
  let workspace = $('#workspace');
  if (!workspace) {
    $('#report').insertAdjacentHTML('beforebegin', '<section class="workspace hidden" id="workspace"></section>');
    workspace = $('#workspace');
  }
    workspace.innerHTML = `<header class="workspace-topbar"><div class="workspace-brand"><span class="workspace-logo">V</span><strong>Vuppo</strong><span class="workspace-separator">/</span><span>${escapeHtml(currentReport.projectName)}</span></div><nav class="workspace-top-actions" aria-label="Ações do editor"><button class="top-action-button active" type="button" title="Preview"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/></svg><span>Preview</span></button><button class="top-action-button" type="button" title="Terminal"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></svg><span>Terminal</span></button><button class="top-action-button" type="button" title="Chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.3-.64L4 20l1.64-3.55A7.4 7.4 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg><span>Chat</span></button><button class="profile-button" type="button" title="Perfil" aria-label="Perfil"><span>U</span></button></nav></header><div class="workspace-body"><nav class="workspace-activity" aria-label="Navegação do projeto"><button class="activity-button active" title="Explorador de arquivos" aria-label="Explorador de arquivos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"/><path d="M3 10h18"/></svg></button><button class="activity-button" title="Git" aria-label="Git"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M8 5h4a6 6 0 0 1 6 6M16 12h-4"/></svg></button><button class="activity-button" title="Extensões" aria-label="Extensões"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H5a2 2 0 0 0-2 2v4h4v2H3v4a2 2 0 0 0 2 2h4v-4h2v4h4a2 2 2 0 0 0 2-2v-4h-4V9h4V5a2 2 0 0 0-2-2h-4v4H9V3Z"/></svg></button><button class="activity-button" title="Security Problems" aria-label="Security Problems"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 7v5c0 4.8-3.2 7.7-9 9-5.8-1.3-9-4.2-9-9V7l9-4Z"/><path d="M12 8v4M12 16h.01"/></svg></button><span></span><button class="activity-button" id="workspace-settings" title="Configurações" aria-label="Configurações"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.08h-2.4v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.46 15a1.7 1.7 0 0 0-1.56-1.03h-.08v-2.4h.08A1.7 1.7 0 0 0 8.46 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.7-1.7.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.08h2.4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.7 1.7-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.08v2.4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg></button></nav>
  </div></div>`;
  workspace.querySelector('.workspace-body').insertAdjacentHTML('beforeend', `<aside class="workspace-sidebar"><div class="sidebar-title">EXPLORER <span>${currentReport.filesScanned}</span></div><section class="explorer-open-editors"><div class="explorer-section-heading">OPEN EDITORS</div><button class="open-editor-item" type="button"><i></i>${escapeHtml(firstFinding ? firstFinding.file.split(/[\\/]/).pop() : (files[0]?.file || 'README.md'))}</button></section><div class="file-tree"><div class="tree-folder">${escapeHtml(currentReport.projectName)}</div>${(files.length ? files : [{ file: 'Nenhum arquivo encontrado' }]).map((file) => `<button class="tree-file" data-file="${escapeHtml(file.file)}"><span class="file-dot"></span>${escapeHtml(file.file)}</button>`).join('')}</div><div class="sidebar-bottom"><span>ANALISE</span><strong>${currentReport.findings.length} achados</strong><small>${currentReport.durationMs} ms · ${currentReport.filesScanned} arquivos</small></div></aside><main class="workspace-editor"><div class="editor-tabs"><span class="editor-tab active"><i></i>${escapeHtml(firstFinding ? firstFinding.file.split(/[\\/]/).pop() : (files[0]?.file || 'README.md'))}</span></div><div class="editor-content"><div class="line-numbers">${Array.from({ length: Math.max(12, firstFinding ? firstFinding.line + 4 : 12) }, (_, index) => `<span>${index + 1}</span>`).join('')}</div><pre class="code-preview"><code>${escapeHtml(firstFinding ? firstFinding.excerpt : (files[0]?.content || '// Nenhum arquivo encontrado.'))}</code></pre></div><div class="editor-panel-label">PROBLEMS <span>${currentReport.findings.length}</span></div></main><aside class="security-panel"><div class="security-heading"><div><span class="panel-eyebrow">VUPPO SECURITY</span><h2>Security Problems</h2></div><span class="finding-total">${currentReport.findings.length}</span></div><div class="severity-summary"><span><b class="severity-critical">${counts.critical || 0}</b> critical</span><span><b class="severity-high">${counts.high || 0}</b> high</span><span><b class="severity-medium">${counts.medium || 0}</b> medium</span></div><div class="workspace-findings">${currentReport.findings.length ? currentReport.findings.map((finding, index) => `<button class="workspace-finding ${index === 0 ? 'selected' : ''}" data-finding-index="${index}"><span class="finding-severity ${finding.severity}"></span><span><strong>${escapeHtml(finding.title)}</strong><small>${escapeHtml(finding.file)}:${finding.line}</small></span></button>`).join('') : '<div class="workspace-empty-state">Nenhum risco encontrado pelas regras atuais.</div>'}</div></aside><footer class="workspace-statusbar"><span>main</span><span>${escapeHtml(currentReport.projectPath)}</span><span>${currentReport.scannedAt.slice(0, 10)} · ${currentReport.filesScanned} arquivos</span></footer>`);
  workspace.querySelector('.editor-tabs').innerHTML = '';
  workspace.querySelector('.editor-content').innerHTML = '<div class="editor-empty"><img src="vuppo-icon.png" alt="Vuppo" /><span>Abra um arquivo para começar</span></div>';
  const fileTree = workspace.querySelector('.file-tree');
  if (files.length) {
    const treeRoot = { folders: new Map(), files: [] };
    files.forEach((file) => {
      const parts = file.file.split(/[\\/]/);
      let node = treeRoot;
      parts.slice(0, -1).forEach((folder) => {
        if (!node.folders.has(folder)) node.folders.set(folder, { folders: new Map(), files: [] });
        node = node.folders.get(folder);
      });
      node.files.push({ ...file, name: parts[parts.length - 1] });
    });
    const renderTreeNode = (node, level = 0) => `${[...node.folders.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([name, child]) => `<div class="tree-folder-item" style="--tree-level:${level}"><span class="tree-chevron">⌄</span><img src="assets/material-icons/folder.svg" class="tree-folder-icon" alt="" /><span class="tree-folder-label">${escapeHtml(name)}</span></div><div class="tree-children">${renderTreeNode(child, level + 1)}</div>`).join('')}${node.files.sort((first, second) => first.name.localeCompare(second.name)).map((file) => `<button class="tree-file" data-file="${escapeHtml(file.file)}" style="--tree-level:${level}" data-extension="${escapeHtml((file.name.includes('.') ? file.name.split('.').pop() : '').toLowerCase())}">${fileIconMarkup(file.name)}<span class="tree-file-label">${escapeHtml(file.name)}</span></button>`).join('')}`;
    fileTree.innerHTML = `<div class="tree-folder"><span class="tree-chevron">⌄</span><img src="assets/material-icons/folder-open.svg" class="tree-folder-icon" alt="" /><span class="tree-folder-label">${escapeHtml(currentReport.projectName)}</span></div><div class="tree-children root-children">${renderTreeNode(treeRoot)}</div>`;
  }
  const explorerTitle = workspace.querySelector('.sidebar-title');
  explorerTitle.innerHTML = '<span>EXPLORER</span><div class="explorer-actions"><button type="button" class="explorer-more" title="Mais ações" aria-label="Mais ações" aria-expanded="false">...</button><div class="explorer-menu hidden"><button type="button" data-explorer-action="collapse">Recolher pasta</button><button type="button" data-explorer-action="new-folder">Nova pasta</button><button type="button" data-explorer-action="new-file">Novo arquivo</button></div></div>';
  const explorerFolder = workspace.querySelector('.tree-folder');
  explorerFolder.innerHTML = `<span class="tree-chevron">⌄</span><img src="assets/material-icons/folder-open.svg" class="tree-folder-icon" alt="" /><span class="tree-folder-label">${escapeHtml(currentReport.projectName)}</span>`;
  workspace.querySelectorAll('.tree-file').forEach((button) => {
    const fileName = button.dataset.file;
    button.dataset.extension = fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  });
  explorerFolder.addEventListener('click', () => {
    const collapsed = explorerFolder.classList.toggle('collapsed');
    explorerFolder.querySelector('.tree-chevron').textContent = collapsed ? '›' : '⌄';
    fileTree.querySelector('.root-children')?.classList.toggle('collapsed', collapsed);
  });
  const explorerMenu = explorerTitle.querySelector('.explorer-menu');
  explorerTitle.querySelector('.explorer-more')?.addEventListener('click', (event) => {
    event.stopPropagation();
    const isHidden = explorerMenu.classList.toggle('hidden');
    event.currentTarget.setAttribute('aria-expanded', String(!isHidden));
  });
  explorerMenu?.querySelector('[data-explorer-action="collapse"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    workspace.querySelectorAll('.tree-folder-item').forEach((folder) => {
      folder.classList.add('collapsed');
      folder.querySelector('.tree-chevron').textContent = '›';
      folder.nextElementSibling?.classList.add('collapsed');
    });
    explorerMenu.classList.add('hidden');
    explorerTitle.querySelector('.explorer-more')?.setAttribute('aria-expanded', 'false');
  });
  explorerMenu?.querySelector('[data-explorer-action="new-folder"]')?.addEventListener('click', async (event) => {
    event.stopPropagation();
    const relativePath = window.prompt('Nome da nova pasta:');
    if (!relativePath?.trim()) return;
    try {
      await window.vuppo.createFolder({ projectPath: currentReport.projectPath, relativePath: relativePath.trim() });
      await analyzeProject(currentReport.projectPath);
    } catch (error) {
      alert(error.message || 'Não foi possível criar a pasta.');
    }
  });
  explorerMenu?.querySelector('[data-explorer-action="new-file"]')?.addEventListener('click', async (event) => {
    event.stopPropagation();
    const relativePath = window.prompt('Nome do novo arquivo:');
    if (!relativePath?.trim()) return;
    try {
      await window.vuppo.createFile({ projectPath: currentReport.projectPath, relativePath: relativePath.trim() });
      await analyzeProject(currentReport.projectPath);
    } catch (error) {
      alert(error.message || 'Não foi possível criar o arquivo.');
    }
  });
  workspace.querySelectorAll('.tree-folder-item').forEach((folder) => folder.addEventListener('click', (event) => {
    event.stopPropagation();
    const children = folder.nextElementSibling;
    if (!children) return;
    const collapsed = children.classList.toggle('collapsed');
    folder.classList.toggle('collapsed', collapsed);
    folder.querySelector('.tree-chevron').textContent = collapsed ? '›' : '⌄';
    const folderIcon = folder.querySelector('.tree-folder-icon');
    if (folderIcon) folderIcon.src = `assets/material-icons/${collapsed ? 'folder' : 'folder-open'}.svg`;
  }));
  setupWorkspaceControls(workspace);
  workspace.classList.remove('hidden');
  workspace.querySelectorAll('.workspace-finding').forEach((button) => button.addEventListener('click', () => selectWorkspaceFinding(Number(button.dataset.findingIndex))));
  workspace.querySelectorAll('.tree-file').forEach((button) => button.addEventListener('click', () => selectWorkspaceFile(button.dataset.file)));
  workspace.querySelector('.open-editor-item')?.addEventListener('click', (event) => {
    if (!event.target.closest('.open-editor-close')) selectWorkspaceFile(firstFinding?.file || files[0]?.file);
  });
  workspace.querySelector('.open-editor-close')?.addEventListener('click', (event) => { event.stopPropagation(); closeActiveEditor(); });
  const openEditorsMenu = workspace.querySelector('.open-editors-menu');
  workspace.querySelector('.open-editors-menu-button')?.addEventListener('click', (event) => { event.stopPropagation(); openEditorsMenu.classList.toggle('hidden'); });
  openEditorsMenu?.querySelector('[data-open-editor-action="close"]')?.addEventListener('click', closeActiveEditor);
  openEditorsMenu?.querySelector('[data-open-editor-action="close-all"]')?.addEventListener('click', closeActiveEditor);
  $('#workspace-close').addEventListener('click', () => { workspace.classList.add('hidden'); $('#dashboard-empty').classList.remove('hidden'); $('#app-shell').classList.add('home-mode'); });
}

function resolveProjectPreviewUrl() {
  if (!currentReport?.projectPath) return 'http://localhost:3000';
  const indexFile = currentReport.files?.find((file) => {
    const normalized = file.file.replace(/\\/g, '/').toLowerCase();
    return normalized === 'index.html' || normalized.endsWith('/index.html') || normalized === 'src/index.html' || normalized === 'public/index.html';
  });
  if (indexFile?.absoluteFile) {
    const normalized = indexFile.absoluteFile.replace(/\\/g, '/');
    return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`;
  }
  return 'http://localhost:3000';
}

function updateEditorTabsMenuVisibility() {
  const editorTabs = document.querySelector('.editor-tabs');
  const actions = editorTabs?.querySelector('.editor-tabs-actions');
  if (!editorTabs || !actions) return;
  const hasTabs = editorTabs.querySelectorAll('.editor-tab').length > 0;
  actions.classList.toggle('hidden', !hasTabs);
  if (!hasTabs) actions.querySelector('.editor-tabs-menu')?.classList.add('hidden');
}

function setupWorkspaceControls(workspace) {
  const body = workspace.querySelector('.workspace-body');
  const sidebar = workspace.querySelector('.workspace-sidebar');
  const securityPanel = workspace.querySelector('.security-panel');
  const editor = workspace.querySelector('.workspace-editor');
  const openEditor = workspace.querySelector('.open-editor-item');
  const editorTab = workspace.querySelector('.editor-tab');
  const openEditorName = openEditor?.textContent.trim() || '';
  if (openEditor) openEditor.innerHTML = `<i></i><span class="open-editor-name">${escapeHtml(openEditorName)}</span><span class="open-editor-close" title="Fechar editor" aria-label="Fechar editor">×</span>`;
  if (editorTab) editorTab.innerHTML = `<span class="editor-tab-icon"></span><span class="editor-tab-name">${escapeHtml(editorTab.textContent.trim())}</span><button class="editor-tab-close" type="button" title="Fechar editor" aria-label="Fechar editor">×</button>`;
  const editorTabs = workspace.querySelector('.editor-tabs');
  editorTabs?.insertAdjacentHTML('beforeend', '<div class="editor-tabs-actions"><button class="editor-tabs-menu-button" type="button" title="Mais ações" aria-label="Mais ações">...</button><div class="editor-tabs-menu hidden"><button type="button" data-editor-action="save">Salvar</button><button type="button" data-editor-action="close">Fechar editor</button><button type="button" data-editor-action="close-all">Fechar todos</button></div></div>');
  updateEditorTabsMenuVisibility();
  editorTabs?.addEventListener('click', (event) => {
    const menuButton = event.target.closest('.editor-tabs-menu-button');
    if (menuButton) {
      const menu = editorTabs.querySelector('.editor-tabs-menu');
      if (menu) {
        const isHidden = menu.classList.toggle('hidden');
        if (!isHidden) {
          const bounds = menuButton.getBoundingClientRect();
          menu.style.top = `${bounds.bottom + 4}px`;
          menu.style.right = `${window.innerWidth - bounds.right}px`;
        }
      }
      event.stopPropagation();
      return;
    }
    const action = event.target.closest('[data-editor-action]')?.dataset.editorAction;
    if (action === 'save') editorTabs.closest('.workspace-editor').querySelector('.code-editor')?.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
    if (action === 'close') closeActiveEditor();
    if (action === 'close-all') [...editorTabs.querySelectorAll('.editor-tab')].forEach((tab) => closeEditorTab(tab.dataset.file));
    if (action) editorTabs.querySelector('.editor-tabs-menu')?.classList.add('hidden');
    const closeButton = event.target.closest('.editor-tab-close');
    const tab = event.target.closest('.editor-tab');
    if (!tab) return;
    if (closeButton) {
      event.stopPropagation();
      closeEditorTab(tab.dataset.file);
      return;
    }
    if (tab.dataset.file) selectWorkspaceFile(tab.dataset.file);
  });
  const openEditorsHeading = workspace.querySelector('.explorer-section-heading');
  if (openEditorsHeading) openEditorsHeading.insertAdjacentHTML('beforeend', '<button type="button" class="open-editors-menu-button" title="Mais ações" aria-label="Mais ações">...</button><div class="open-editors-menu hidden"><button type="button" data-open-editor-action="close">Fechar editor</button><button type="button" data-open-editor-action="close-all">Fechar todos</button></div>');
  workspace.querySelector('.workspace-brand')?.remove();
  securityPanel.querySelector('.security-heading').insertAdjacentHTML('beforeend', '<button class="security-panel-close" type="button" aria-label="Fechar Security Problems">&#10005;</button>');
  securityPanel.classList.add('is-collapsed');
  body.classList.add('security-closed');
  workspace.querySelector('.workspace-topbar').insertAdjacentHTML('afterbegin', '<nav class="workspace-menus" aria-label="Menu do workspace"><div class="workspace-menu"><button class="workspace-menu-button" type="button" aria-expanded="false">File</button><div class="workspace-menu-dropdown"><button type="button" data-workspace-view="explorer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9.5a2 2 0 0 1 2-2Z"/><path d="M3 10h18"/></svg><span>Explorer</span></button></div></div><div class="workspace-menu"><button class="workspace-menu-button" type="button" aria-expanded="false">Workspace</button><div class="workspace-menu-dropdown"><button type="button" data-workspace-view="git"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M8 5h4a6 6 0 0 1 6 6M16 12h-4"/></svg><span>Source control</span></button><button type="button" data-workspace-view="extensions"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H5a2 2 0 0 0-2 2v4h4v2H3v4a2 2 0 0 0 2 2h4v-4h2v4h4v-4h2a2 2 0 0 0 2-2v-4h-4V5a2 2 0 0 0-2-2h-4v4H9V3Z"/></svg><span>Extensões</span></button><button type="button" data-workspace-view="security"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg><span>Security Problems</span></button></div></div></nav>');
  workspace.querySelector('.workspace-topbar').insertAdjacentHTML('afterbegin', '<nav class="workspace-menus" aria-label="Menu do workspace"><div class="workspace-menu"><button class="workspace-menu-button file-menu-button" type="button" aria-expanded="false"><img src="vuppo-icon.png" alt="" />File</button><div class="workspace-menu-dropdown"><button type="button" data-workspace-view="explorer"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9.5a2 2 0 0 1 2-2Z"/><path d="M3 10h18"/></svg><span>Explorer</span></button></div></div><div class="workspace-menu"><button class="workspace-menu-button" type="button" aria-expanded="false">Workspace</button><div class="workspace-menu-dropdown"><button type="button" data-workspace-view="git"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M8 5h4a6 6 0 0 1 6 6M16 12h-4"/></svg><span>Source control</span></button><button type="button" data-workspace-view="extensions"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H5a2 2 0 0 0-2 2v4h4v2H3v4a2 2 0 0 0 2 2h4v-4h2v4h4v-4h2a2 2 0 0 0 2-2v-4h-4V5a2 2 0 0 0-2-2h-4v4H9V3Z"/></svg><span>Extensões</span></button><button type="button" data-workspace-view="security"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z"/><path d="m9 12 2 2 4-4"/></svg><span>Security Problems</span></button></div></div></nav>');
    workspace.querySelector('.workspace-menu-dropdown').insertAdjacentHTML('beforeend', '<button type="button" data-file-action="new-file"><span>New File</span></button><button type="button" data-file-action="new-window"><span>New Window</span></button><button type="button" data-file-action="open-file"><span>Open File...</span></button><button type="button" data-file-action="open-folder"><span>Open Folder...</span></button><button type="button" data-file-action="open-project"><span>Open Project...</span></button><button type="button" data-file-action="open-recent"><span>Open Recent</span></button><button type="button" data-file-action="save"><span>Save</span></button><button type="button" data-file-action="save-as"><span>Save As...</span></button><button type="button" data-file-action="save-all"><span>Save All</span></button><button type="button" data-file-action="close-editor"><span>Close Editor</span></button><button type="button" data-file-action="close-folder"><span>Close Folder</span></button><button type="button" data-file-action="exit"><span>Exit</span></button>');
  workspace.querySelectorAll('.workspace-menus').forEach((menu, index) => { if (index > 0) menu.remove(); });
  const fileButton = workspace.querySelector('.file-menu-button');
  const fileIcon = fileButton?.querySelector('img');
  if (fileButton && fileIcon) {
    fileIcon.className = 'file-menu-icon';
    fileButton.closest('.workspace-menu').before(fileIcon);
  }
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
  const previewPanel = editor.querySelector('[data-feature-panel="preview"]');
  const previewUrl = resolveProjectPreviewUrl();
  const previewPlaceholder = previewPanel.querySelector('.preview-empty');
  previewPanel.querySelector('.preview-target').innerHTML = '<span class="desktop-icon">▣</span><span>Desktop</span><b>⌄</b>';
  previewPanel.querySelector('.preview-url').innerHTML = `<span class="globe-icon"></span><span class="preview-url-text">${previewUrl}</span>`;
  let previewWebview = previewPanel.querySelector('webview');
  if (!previewWebview) {
    previewWebview = document.createElement('webview');
    previewWebview.className = 'preview-webview';
    previewWebview.setAttribute('allowpopups', 'true');
    previewWebview.setAttribute('partition', 'persist:vuppo-preview');
    previewPanel.appendChild(previewWebview);
  }
  previewWebview.setAttribute('src', previewUrl);
  previewWebview.addEventListener('did-finish-load', () => {
    previewPlaceholder?.classList.add('hidden');
  });
  previewWebview.addEventListener('did-fail-load', () => {
    previewPlaceholder?.classList.remove('hidden');
    const title = previewPlaceholder?.querySelector('strong');
    const text = previewPlaceholder?.querySelector('span');
    if (title) title.textContent = 'Preview indisponível';
    if (text) text.textContent = 'Inicie o projeto em http://localhost:3000 para visualizar a página.';
  });
  previewPanel.querySelector('[aria-label="Atualizar preview"]')?.addEventListener('click', () => {
    previewWebview.reload();
  });
  previewPanel.querySelector('[aria-label="Abrir preview em nova janela"]')?.addEventListener('click', () => {
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  });
  const chatPanel = editor.querySelector('[data-feature-panel="chat"]');
  chatPanel.querySelector('.chat-title strong').textContent = 'Chat';
  chatPanel.querySelector('.chat-agent-icon')?.remove();
  chatPanel.querySelector('.chat-welcome-icon')?.remove();
  const chatHeadingActions = chatPanel.querySelector('.chat-heading-actions');
  chatHeadingActions.innerHTML = '<button type="button" class="chat-heading-button chat-menu-button" title="Mais opções" aria-label="Mais opções">⋯</button><div class="chat-actions-menu hidden"><button type="button" data-chat-action="new">Novo chat</button><button type="button" data-chat-action="history">Histórico</button><button type="button" data-chat-action="close">Fechar chat</button></div>';
  chatPanel.querySelector('.chat-model').textContent = 'Modelo';
  const chatThread = chatPanel.querySelector('.chat-thread');
  chatThread.insertAdjacentHTML('beforeend', '<div class="chat-history hidden"><strong>Histórico</strong><span>Nenhuma conversa salva ainda.</span></div>');
  const chatInput = chatPanel.querySelector('.chat-input');
  chatInput.innerHTML = '<button type="button" class="chat-attach" title="Adicionar arquivo ou imagem" aria-label="Adicionar arquivo ou imagem">+</button><textarea rows="1" placeholder="Digite uma mensagem..." aria-label="Mensagem para o chat"></textarea><button type="button" class="chat-send" title="Enviar mensagem" aria-label="Enviar mensagem">↑</button><input class="chat-file-input" type="file" accept="image/*,.txt,.md,.json,.js,.ts,.html,.css" multiple hidden />';
  const chatHistory = chatPanel.querySelector('.chat-history');
  const chatMessageInput = chatInput.querySelector('textarea');
  const chatFileInput = chatInput.querySelector('.chat-file-input');
  const appendChatMessage = (message, className) => {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${className}`;
    messageElement.textContent = message;
    chatThread.insertBefore(messageElement, chatHistory);
  };
  const sendChatMessage = () => {
    const message = chatMessageInput.value.trim();
    if (!message) return;
    appendChatMessage(message, 'chat-message-user');
    chatMessageInput.value = '';
    chatMessageInput.style.height = '';
  };
  chatPanel.querySelector('.chat-attach').addEventListener('click', () => chatFileInput.click());
  chatFileInput.addEventListener('change', () => {
    [...chatFileInput.files].forEach((file) => appendChatMessage(`Arquivo anexado: ${file.name}`, 'chat-message-file'));
  });
  chatPanel.querySelector('.chat-send').addEventListener('click', sendChatMessage);
  chatMessageInput.addEventListener('input', () => {
    chatMessageInput.style.height = '';
    chatMessageInput.style.height = `${Math.min(chatMessageInput.scrollHeight, 100)}px`;
  });
  chatMessageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  });
  const chatActionsMenu = chatPanel.querySelector('.chat-actions-menu');
  chatPanel.querySelector('.chat-menu-button').addEventListener('click', () => chatActionsMenu.classList.toggle('hidden'));
  chatActionsMenu.querySelector('[data-chat-action="new"]').addEventListener('click', () => {
    chatThread.querySelectorAll('.chat-message').forEach((message) => message.remove());
    chatHistory.classList.add('hidden');
    chatActionsMenu.classList.add('hidden');
  });
  chatActionsMenu.querySelector('[data-chat-action="history"]').addEventListener('click', () => {
    chatHistory.classList.toggle('hidden');
    chatActionsMenu.classList.add('hidden');
  });
  chatActionsMenu.querySelector('[data-chat-action="close"]').addEventListener('click', () => {
    chatPanel.classList.add('hidden');
    workspace.querySelector('.top-action-button[title="Chat"]')?.classList.remove('active');
    workspace.classList.remove('chat-open');
    chatActionsMenu.classList.add('hidden');
  });
  const terminalPanel = editor.querySelector('[data-feature-panel="terminal"]');
  const terminalTabs = terminalPanel.querySelector('.terminal-tabs');
  terminalTabs.querySelector('.terminal-tab').innerHTML = '<span class="terminal-tab-label">Terminal</span><span class="terminal-tab-close" role="button" aria-label="Remover sessão">×</span>';
  const terminalActionsMenu = document.createElement('div');
  terminalActionsMenu.className = 'terminal-actions-menu hidden';
  terminalActionsMenu.innerHTML = '<button type="button" data-terminal-action="clear">Limpar terminal</button><button type="button" data-terminal-action="close">Fechar Terminal</button>';
  terminalPanel.appendChild(terminalActionsMenu);
  const terminalOutput = terminalPanel.querySelector('.terminal-output');
  terminalOutput.innerHTML = '<textarea class="terminal-screen" aria-label="Terminal" spellcheck="false"></textarea><span class="terminal-block-caret" aria-hidden="true"></span>';
  const terminalScreen = terminalPanel.querySelector('.terminal-screen');
  const terminalCaret = terminalPanel.querySelector('.terminal-block-caret');
  const terminalInput = terminalScreen;
  const terminalSessions = new Map();
  let activeTerminalSession = null;
  const updateTerminalCaret = () => {
    const styles = window.getComputedStyle(terminalInput);
    const textBeforeCaret = terminalInput.value.slice(0, terminalInput.selectionStart ?? terminalInput.value.length);
    const lines = textBeforeCaret.split('\n');
    const fontSize = parseFloat(styles.fontSize) || 12;
    const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.6;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = styles.font;
    const textWidth = context.measureText(lines[lines.length - 1]).width;
    const left = terminalInput.offsetLeft + (parseFloat(styles.paddingLeft) || 0) + textWidth;
    const top = terminalInput.offsetTop + (parseFloat(styles.paddingTop) || 0) + (lines.length - 1) * lineHeight - terminalInput.scrollTop;
    terminalCaret.style.left = `${Math.max(0, left)}px`;
    terminalCaret.style.top = `${Math.max(0, top)}px`;
    terminalCaret.style.height = `${lineHeight}px`;
    terminalCaret.classList.toggle('is-hidden', document.activeElement !== terminalInput);
  };
  const focusTerminal = () => {
    terminalInput.focus();
    terminalInput.setSelectionRange(terminalInput.value.length, terminalInput.value.length);
    updateTerminalCaret();
  };
  const renderTerminalInput = () => {
    if (!activeTerminalSession) return;
    terminalInput.value = `${activeTerminalSession.output}${activeTerminalSession.inputBuffer}`;
    terminalInput.setSelectionRange(terminalInput.value.length, terminalInput.value.length);
    updateTerminalCaret();
  };
  const terminalMaximize = terminalPanel.querySelector('.terminal-maximize');
  const activateTerminal = (tab) => {
    terminalTabs.querySelectorAll('.terminal-tab').forEach((item) => item.classList.toggle('active', item === tab));
    activeTerminalSession = terminalSessions.get(tab);
    terminalScreen.value = activeTerminalSession ? `${activeTerminalSession.output}${activeTerminalSession.inputBuffer}` : '';
    terminalScreen.scrollTop = terminalScreen.scrollHeight;
    terminalInput.disabled = false;
    focusTerminal();
  };
  const restoreTerminalInput = () => {
    if (!activeTerminalSession) return;
    const output = activeTerminalSession.output;
    const typedText = terminalInput.value.startsWith(output)
      ? terminalInput.value.slice(output.length)
      : activeTerminalSession.inputBuffer;
    activeTerminalSession.inputBuffer = typedText;
    renderTerminalInput();
  };
  const appendTerminalOutput = (session, data) => {
    session.output += data;
    if (session === activeTerminalSession) {
      terminalScreen.value = `${session.output}${session.inputBuffer}`;
      terminalScreen.scrollTop = terminalScreen.scrollHeight;
      terminalScreen.focus();
      terminalScreen.setSelectionRange(terminalScreen.value.length, terminalScreen.value.length);
      updateTerminalCaret();
    }
  };
  const createTerminalSession = async (tab) => {
    const session = terminalSessions.get(tab) || { tab, id: null, output: '', inputBuffer: '' };
      terminalSessions.set(tab, session);
      session.inputBuffer = '';
    try {
      const terminal = await window.vuppo.createTerminal(currentReport.projectPath);
      session.id = terminal.id;
      tab.querySelector('.terminal-tab-label').textContent = terminal.shell;
      if (session === activeTerminalSession) {
        terminalInput.disabled = false;
        focusTerminal();
      }
    } catch (error) { appendTerminalOutput(session, `Erro ao iniciar terminal: ${error.message}\r\n`); }
    return session;
  };
  window.vuppo.onTerminalData((payload) => {
    const session = [...terminalSessions.values()].find((item) => item.id === payload.id);
    if (session) appendTerminalOutput(session, payload.data || '');
  });
  terminalInput.addEventListener('input', () => {
    restoreTerminalInput();
  });
  terminalInput.addEventListener('scroll', updateTerminalCaret);
  terminalInput.addEventListener('select', updateTerminalCaret);
  terminalInput.addEventListener('blur', updateTerminalCaret);
  const sendTerminalInput = async () => {
    if (!activeTerminalSession?.id) return;
    const input = activeTerminalSession.inputBuffer;
    if (!input.trim()) return;
    await window.vuppo.writeTerminal(activeTerminalSession.id, `${input}\r\n`);
    activeTerminalSession.inputBuffer = '';
    terminalInput.value = activeTerminalSession.output;
    terminalInput.setSelectionRange(terminalInput.value.length, terminalInput.value.length);
    updateTerminalCaret();
  };
  terminalPanel.addEventListener('keydown', async (event) => {
    if (event.target !== terminalInput && event.target.closest('button')) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      await sendTerminalInput();
      focusTerminal();
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (activeTerminalSession?.inputBuffer) {
        activeTerminalSession.inputBuffer = activeTerminalSession.inputBuffer.slice(0, -1);
        renderTerminalInput();
      }
      focusTerminal();
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!activeTerminalSession) return;
      activeTerminalSession.inputBuffer += event.key;
      renderTerminalInput();
      focusTerminal();
    }
  });
  terminalScreen.addEventListener('click', () => {
    terminalInput.focus();
    terminalInput.setSelectionRange(terminalInput.value.length, terminalInput.value.length);
    updateTerminalCaret();
  });
  const updateTerminalLimit = () => {
    const newTerminalButton = terminalPanel.querySelector('.terminal-new');
    const limitReached = terminalTabs.children.length >= 7;
    newTerminalButton.disabled = limitReached;
    newTerminalButton.title = limitReached ? 'Limite de 7 sessões atingido' : 'Novo terminal';
  };
  const closeTerminalTab = (tab) => {
    if (!tab) return;
    const session = terminalSessions.get(tab);
    if (session?.id) window.vuppo.killTerminal(session.id);
    terminalSessions.delete(tab);
    if (terminalTabs.children.length > 1) {
      const nextTab = tab.nextElementSibling || tab.previousElementSibling;
      tab.remove();
      activateTerminal(nextTab);
      updateTerminalLimit();
      return;
    }
    tab.remove();
    terminalPanel.classList.add('hidden');
    workspace.querySelector('.top-action-button[title="Terminal"]')?.classList.remove('active');
    updateTerminalLimit();
  };
  const clearTerminalSession = async (session) => {
    if (!session) return;
    if (session.id) {
      const clearCommand = process.platform === 'win32' ? 'cls\r' : 'clear\r';
      await window.vuppo.writeTerminal(session.id, clearCommand);
    }
    session.output = '';
    session.inputBuffer = '';
    if (session === activeTerminalSession) {
      terminalScreen.value = '';
      terminalInput.value = '';
      terminalInput.setSelectionRange(0, 0);
    }
    updateTerminalCaret();
  };
  const hideTerminalActionsMenu = () => terminalActionsMenu.classList.add('hidden');
  const showTerminalActionsMenu = (tab, event) => {
    if (!tab) return;
    activateTerminal(tab);
    const isHidden = terminalActionsMenu.classList.contains('hidden');
    if (isHidden) {
      const bounds = tab.getBoundingClientRect();
      terminalActionsMenu.style.top = `${bounds.bottom + 4}px`;
      terminalActionsMenu.style.left = `${Math.max(10, bounds.left)}px`;
      terminalActionsMenu.classList.remove('hidden');
    } else {
      hideTerminalActionsMenu();
    }
    event?.stopPropagation();
  };
  terminalActionsMenu.querySelector('[data-terminal-action="clear"]').addEventListener('click', async () => {
    const activeTab = terminalTabs.querySelector('.terminal-tab.active');
    await clearTerminalSession(terminalSessions.get(activeTab));
    hideTerminalActionsMenu();
    terminalInput.focus();
    updateTerminalCaret();
  });
  terminalActionsMenu.querySelector('[data-terminal-action="close"]').addEventListener('click', () => {
    const activeTab = terminalTabs.querySelector('.terminal-tab.active');
    closeTerminalTab(activeTab);
    hideTerminalActionsMenu();
  });
  terminalTabs.addEventListener('click', (event) => {
    const close = event.target.closest('.terminal-tab-close');
    if (close) {
      const tab = close.closest('.terminal-tab');
      closeTerminalTab(tab);
      hideTerminalActionsMenu();
      event.stopPropagation();
      return;
    }
    const tab = event.target.closest('.terminal-tab');
    if (tab && event.button === 2) {
      showTerminalActionsMenu(tab, event);
      return;
    }
    if (tab) activateTerminal(tab);
  });
  document.addEventListener('contextmenu', (event) => {
    const targetTab = event.target.closest('.terminal-tab');
    if (!targetTab) {
      hideTerminalActionsMenu();
      return;
    }
    event.preventDefault();
    showTerminalActionsMenu(targetTab, event);
  });
  document.addEventListener('click', (event) => {
    if (!terminalActionsMenu.contains(event.target) && !event.target.closest('.terminal-tab')) {
      hideTerminalActionsMenu();
    }
  });
  terminalPanel.querySelector('.terminal-new').addEventListener('click', () => {
    if (terminalTabs.children.length >= 7) return;
    const usedNames = new Set([...terminalTabs.querySelectorAll('.terminal-tab-label')].map((label) => label.textContent));
    let terminalNumber = 2;
    while (usedNames.has(`Terminal ${terminalNumber}`)) terminalNumber += 1;
    const tab = document.createElement('button');
    tab.className = 'terminal-tab';
    tab.type = 'button';
    tab.innerHTML = `<span class="terminal-tab-label">Terminal ${terminalNumber}</span><span class="terminal-tab-close" role="button" aria-label="Remover sessão">×</span>`;
    terminalTabs.appendChild(tab);
    createTerminalSession(tab);
    activateTerminal(tab);
    updateTerminalLimit();
  });
  terminalMaximize.addEventListener('click', () => {
    const maximized = terminalPanel.classList.toggle('is-maximized');
    terminalMaximize.textContent = maximized ? '❐' : '□';
    terminalMaximize.title = maximized ? 'Restaurar terminal' : 'Maximizar terminal';
    terminalMaximize.setAttribute('aria-label', terminalMaximize.title);
  });
  terminalPanel.querySelector('.terminal-trash').addEventListener('click', () => {
    const activeTab = terminalTabs.querySelector('.terminal-tab.active');
    closeTerminalTab(activeTab);
    hideTerminalActionsMenu();
  });
  const initialTerminalTab = terminalTabs.querySelector('.terminal-tab');
  terminalSessions.set(initialTerminalTab, { tab: initialTerminalTab, id: null, output: '', inputBuffer: '' });
  activateTerminal(initialTerminalTab);
  createTerminalSession(initialTerminalTab);
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
      if (button.dataset.fileAction === 'save') workspace.querySelector('.code-editor')?.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
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
        if (feature === 'terminal' && isOpen === false) focusTerminal();
      }
      workspace.querySelector('.editor-tabs').classList.toggle('preview-active', feature === 'preview' && !isOpen);
      workspace.classList.toggle('preview-open', feature === 'preview' && !isOpen);
      workspace.classList.toggle('chat-open', !workspace.querySelector('[data-feature-panel="chat"]').classList.contains('hidden'));
    });
  });
  workspace.querySelector('.panel-eyebrow')?.remove();
  workspace.querySelector('.finding-total')?.remove();
  const syncFeatureButtons = () => workspace.querySelectorAll('.top-action-button').forEach((item) => {
    const itemPanel = workspace.querySelector(`[data-feature-panel="${item.title.toLowerCase()}" ]`);
    item.classList.toggle('active', Boolean(itemPanel && !itemPanel.classList.contains('hidden')));
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
    const icon = maximizeButton?.querySelector('.window-icon');
    if (icon) {
      icon.className = 'window-icon maximize-icon';
    }
    maximizeButton.title = 'Maximizar';
    maximizeButton.setAttribute('aria-label', 'Maximizar');
  };
  workspace.querySelector('[data-window-action="minimize"]').addEventListener('click', () => window.vuppo.minimizeWindow());
  let windowStateRequest = 0;
  const syncWindowState = async (statePromise) => {
    const request = ++windowStateRequest;
    const state = await statePromise;
    if (request === windowStateRequest) setWindowState(state);
  };
  maximizeButton.addEventListener('click', () => syncWindowState(window.vuppo.toggleMaximizeWindow()));
  workspace.querySelector('[data-window-action="close"]').addEventListener('click', () => window.vuppo.closeWindow());
  syncWindowState(window.vuppo.isWindowMaximized());
  profileButton.addEventListener('click', () => profileMenu.classList.toggle('hidden'));
  profileMenu.querySelector('.profile-close').addEventListener('click', () => profileMenu.classList.add('hidden'));
}

function selectWorkspaceFinding(index) {
  const finding = currentReport.findings[index];
  if (!finding) return;
  document.querySelectorAll('.workspace-finding').forEach((button) => button.classList.toggle('selected', Number(button.dataset.findingIndex) === index));
  document.querySelectorAll('.tree-file').forEach((button) => button.classList.toggle('selected', button.dataset.file === finding.file));
  const tab = document.querySelector('.editor-tab');
  const fileData = currentReport.files?.find((file) => file.file === finding.file);
  openWorkspaceTab(finding.file);
  renderWorkspaceFile(fileData, finding.line, finding.excerpt);
}

function selectWorkspaceFile(file) {
  const fileData = currentReport.files?.find((entry) => entry.file === file);
  if (!fileData) return;
  const findingIndex = currentReport.findings.findIndex((finding) => finding.file === file);
  if (findingIndex >= 0) {
    selectWorkspaceFinding(findingIndex);
    return;
  }
  const tab = document.querySelector('.editor-tab');
  document.querySelectorAll('.tree-file').forEach((button) => button.classList.toggle('selected', button.dataset.file === file));
  openWorkspaceTab(file);
  renderWorkspaceFile(fileData);
}

function openWorkspaceTab(file) {
  const tabs = document.querySelector('.editor-tabs');
  if (!tabs) return;
  let tab = [...tabs.querySelectorAll('.editor-tab')].find((item) => item.dataset.file === file);
  if (!tab) tab = [...tabs.querySelectorAll('.editor-tab')].find((item) => !item.dataset.file);
  if (!tab) {
    tab = document.createElement('span');
    tab.className = 'editor-tab';
    tab.innerHTML = '<span class="editor-tab-icon"></span><span class="editor-tab-name"></span><button class="editor-tab-close" type="button" title="Fechar editor" aria-label="Fechar editor">×</button>';
    const tabsActions = tabs.querySelector('.editor-tabs-actions');
    if (tabsActions) tabs.insertBefore(tab, tabsActions);
    else tabs.appendChild(tab);
  }
  updateEditorLabels(tab, file);
  tabs.querySelectorAll('.editor-tab').forEach((item) => item.classList.toggle('active', item === tab));
  updateEditorTabsMenuVisibility();
  tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
}

function updateEditorLabels(tab, file) {
  const name = file.split(/[\\/]/).pop();
  tab.dataset.file = file;
  tab.querySelector('.editor-tab-icon').innerHTML = fileIconMarkup(name);
  tab.querySelector('.editor-tab-name').textContent = name;
  const openEditor = document.querySelector('.open-editor-item');
  if (openEditor) {
    openEditor.classList.remove('hidden');
    openEditor.dataset.file = file;
    openEditor.querySelector('.open-editor-name').textContent = name;
  }
}

function closeEditorTab(file) {
  const tabs = document.querySelector('.editor-tabs');
  const tab = [...(tabs?.querySelectorAll('.editor-tab') || [])].find((item) => item.dataset.file === file);
  if (!tab) return;
  const wasActive = tab.classList.contains('active');
  tab.remove();
  updateEditorTabsMenuVisibility();
  if (!wasActive) return;
  const nextTab = tabs.querySelector('.editor-tab:last-child');
  if (nextTab) selectWorkspaceFile(nextTab.dataset.file);
  else document.querySelector('.editor-content').innerHTML = '<div class="editor-empty"><img src="vuppo-icon.png" alt="Vuppo" /><span>Abra um arquivo para começar</span></div>';
}

function closeActiveEditor() {
  const activeTab = document.querySelector('.editor-tab.active');
  if (activeTab) closeEditorTab(activeTab.dataset.file);
}

function renderWorkspaceFile(fileData, findingLine, fallbackText) {
  const editorContent = document.querySelector('.editor-content');
  if (!editorContent || !fileData) return;
  if (fileData.isImage) {
    editorContent.innerHTML = fileData.content
      ? `<div class="image-preview"><header class="image-preview-heading"><span class="image-preview-name">${escapeHtml(fileData.file.split(/[\\/]/).pop())}</span><button class="image-preview-close" type="button" title="Fechar imagem" aria-label="Fechar imagem">×</button></header><img src="${fileData.content}" alt="${escapeHtml(fileData.file)}" /><span>${escapeHtml(fileData.file)}</span></div>`
      : `<div class="image-preview image-preview-empty"><header class="image-preview-heading"><span class="image-preview-name">${escapeHtml(fileData.file.split(/[\\/]/).pop())}</span><button class="image-preview-close" type="button" title="Fechar imagem" aria-label="Fechar imagem">×</button></header><strong>Imagem muito grande para a prévia</strong><span>Abra o arquivo para visualizar a imagem.</span></div>`;
    editorContent.querySelector('.image-preview-close')?.addEventListener('click', closeActiveEditor);
    return;
  }
  const content = fileData.content ?? fallbackText ?? '// Arquivo sem conteúdo legível.';
  const safeContent = typeof content === 'string' && content.trim().length > 0 ? content : (fallbackText || '// Arquivo vazio ou não legível.');
  const lineCount = safeContent.split(/\r?\n/).length;
  editorContent.innerHTML = `<div class="line-numbers">${Array.from({ length: Math.max(12, findingLine || lineCount, lineCount) }, (_, line) => `<span>${line + 1}</span>`).join('')}</div><div class="code-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Editor de código" spellcheck="false"></div>`;
  const codeEditor = editorContent.querySelector('.code-editor');
  const lineNumbers = editorContent.querySelector('.line-numbers');
  codeEditor.textContent = safeContent;
  codeEditor.tabIndex = 0;
  codeEditor.focus();
  codeEditor.addEventListener('scroll', () => {
    lineNumbers.style.transform = `translateY(${-codeEditor.scrollTop}px)`;
  });
  codeEditor.addEventListener('input', () => {
    const editedContent = codeEditor.innerText.replace(/\r\n/g, '\n');
    const lines = editedContent.split('\n').length;
    lineNumbers.innerHTML = Array.from({ length: Math.max(12, lines) }, (_, line) => `<span>${line + 1}</span>`).join('');
    fileData.content = editedContent;
  });
  codeEditor.addEventListener('keydown', async (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      try {
        await window.vuppo.writeFile({ projectPath: currentReport.projectPath, filePath: fileData.absoluteFile, content: codeEditor.innerText.replace(/\r\n/g, '\n') });
        codeEditor.classList.add('saved');
        setTimeout(() => codeEditor.classList.remove('saved'), 700);
      } catch (error) { alert(error.message || 'Não foi possível salvar o arquivo.'); }
    }
  });
}

function fileIconMarkup(fileName) {
  const extension = fileName === '.env' ? 'env' : fileName.includes('.') ? fileName.split('.').pop().toLowerCase() : '';
  const type = {
    js: 'javascript', jsx: 'react', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'react-typescript',
    json: 'json', yml: 'yaml', yaml: 'yaml',
    html: 'html', htm: 'html', xml: 'xml',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    py: 'python', java: 'java', go: 'go', rb: 'ruby', php: 'php',
    sql: 'sql', sh: 'shell', env: 'env',
    md: 'markdown', txt: 'text',
    png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'svg', ico: 'image', bmp: 'image'
  }[extension] || 'file';
  let materialIcon = { javascript: 'javascript', typescript: 'typescript', react: 'react', 'react-typescript': 'react', json: 'json', yaml: 'yaml', html: 'html', xml: 'xml', css: 'css', scss: 'css', less: 'css', python: 'python', markdown: 'markdown', text: 'text', file: 'file' }[type] || 'file';
  if (materialIconCatalog) {
    const baseName = fileName.toLowerCase();
    const extension = baseName.includes('.') ? baseName.split('.').pop() : '';
    const catalogIcon = materialIconCatalog.fileNames?.[baseName] || materialIconCatalog.fileExtensions?.[extension];
    if (catalogIcon && materialIconCatalog.iconDefinitions?.[catalogIcon]) materialIcon = materialIconCatalog.iconDefinitions[catalogIcon].iconPath.split('/').pop().replace(/\.svg$/, '');
  }
  return `<img src="assets/material-icons/${materialIcon}.svg" class="tree-file-icon file-icon-${type}" alt="" />`;
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

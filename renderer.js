let isSignup = false;
let authStep = 'email';
let currentReport = null;
let materialIconCatalog = null;
let activeInlineCreate = null;
const RECENT_PROJECTS_KEY = 'vuppo.recentProjects';
const $ = (selector) => document.querySelector(selector);

const SETTINGS_STORAGE_KEY = 'vuppo.settings';
const VUPPO_VERSION = '1.0.0';
const CHAT_HISTORY_LIMIT = 20;
const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
const DEFAULT_SETTINGS = {
  editorFontSize: 12,
  editorWordWrap: true,
  editorLineNumbers: true,
  editorMinimap: true,
  editorMinimapWidth: 120,
  editorTabSize: 2,
  autoSave: 'off',
  autoSaveDelay: 1000,
  chatConfirmClearHistory: true,
  chatFontSize: 11,
  securityMinSeverity: 'all',
  gitConfirmDiscard: true,
  gitConfirmCommit: false,
  gitSmartCommit: false,
  gitShowUntracked: true,
  gitAutoRefresh: true,
};
const SETTINGS_SCHEMA = [
  { id: 'account', label: 'Conta', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>', options: [] },
  { id: 'editor', label: 'Editor', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>', options: [
    { key: 'editorFontSize', type: 'number', label: 'Tamanho da fonte do código', description: 'Tamanho da fonte usada no editor de código e na prévia.', min: 8, max: 32, step: 1 },
    { key: 'editorWordWrap', type: 'checkbox', label: 'Quebra de linha automática', description: 'Define se as linhas longas são quebradas para caber na largura do editor.' },
    { key: 'editorLineNumbers', type: 'checkbox', label: 'Números de linha', description: 'Exibe os números de linha ao lado do código.' },
    { key: 'editorMinimap', type: 'checkbox', label: 'Mini mapa', description: 'Exibe o mini mapa de navegação ao lado do código do editor.' },
    { key: 'editorMinimapWidth', type: 'number', label: 'Largura do mini mapa', description: 'Largura em pixels do mini mapa de navegação do editor (120px é o padrão).', min: 60, max: 320, step: 10, isDisabled: (current) => current.editorMinimap === false },
    { key: 'editorTabSize', type: 'number', label: 'Tamanho da tabulação', description: 'Quantidade de espaços equivalente a uma tabulação.', min: 2, max: 8, step: 1 },
    { key: 'autoSave', type: 'select', label: 'Salvamento automático', description: 'Salva as alterações do editor automaticamente após um atraso.', choices: [['off', 'off'], ['afterDelay', 'afterDelay']] },
    { key: 'autoSaveDelay', type: 'number', label: 'Atraso do salvamento automático', description: 'Tempo em milissegundos após digitar antes de salvar (requer autoSave: afterDelay).', min: 200, max: 10000, step: 100, isDisabled: (current) => current.autoSave !== 'afterDelay' },
  ] },
  { id: 'chat', label: 'Chat', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.3-.64L4 20l1.64-3.55A7.4 7.4 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"/></svg>', options: [
    { key: 'chatConfirmClearHistory', type: 'checkbox', label: 'Confirmar antes de excluir conversas', description: 'Pede confirmação ao excluir uma conversa do histórico ou todo o histórico do chat.' },
    { key: 'chatFontSize', type: 'number', label: 'Tamanho da fonte do chat', description: 'Tamanho da fonte usado nas mensagens e no campo de texto do chat.', min: 10, max: 18, step: 1 },
  ] },
  { id: 'security', label: 'Segurança', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 5.5v5c0 4.6 3 8.4 7 10 4-1.6 7-5.4 7-10v-5Z"/><path d="m9.3 12 2 2 3.4-3.8"/></svg>', options: [
    { key: 'securityMinSeverity', type: 'select', label: 'Severidade mínima exibida', description: 'Mostra no painel Security Problems apenas riscos com essa severidade ou superior.', choices: [['all', 'Todas'], ['medium', 'Médio e superior'], ['high', 'Alto e superior'], ['critical', 'Somente crítico']] },
  ] },
  { id: 'git', label: 'Git', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M8 5h4a6 6 0 0 1 6 6M16 12h-4"/></svg>', options: [
    { key: 'gitConfirmDiscard', type: 'checkbox', label: 'Confirmar antes de descartar alterações', description: 'Pede confirmação ao descartar as alterações de um arquivo no controle de versão.' },
    { key: 'gitConfirmCommit', type: 'checkbox', label: 'Confirmar antes de criar o commit', description: 'Pede confirmação mostrando quantos arquivos serão enviados antes de criar o commit.' },
    { key: 'gitSmartCommit', type: 'checkbox', label: 'Preparar tudo automaticamente ao commitar', description: 'Quando nada estiver no Stage, adiciona todas as alterações automaticamente antes de criar o commit (smart commit).' },
    { key: 'gitShowUntracked', type: 'checkbox', label: 'Exibir arquivos não rastreados', description: 'Mostra os arquivos novos (não rastreados) na lista de alterações do controle de versão.' },
    { key: 'gitAutoRefresh', type: 'checkbox', label: 'Atualizar ao voltar para a janela', description: 'Atualiza o status do controle de versão quando a janela da VUPPO volta a receber foco.' },
  ] },
  { id: 'about', label: 'Sobre', icon: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>', options: [] },
];
let settings = loadSettings();
let activeMinimapRefresh = null;

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
  refreshUsage();
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
    rememberProject(currentReport.projectPath);
    renderReport();
    refreshUsage();
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
  window.VuppoEditor?.disposeAll();
    workspace.innerHTML = `<header class="workspace-topbar"><div class="workspace-brand"><span class="workspace-logo">V</span><strong>Vuppo</strong><span class="workspace-separator">/</span><span>${escapeHtml(currentReport.projectName)}</span></div><nav class="workspace-top-actions" aria-label="Ações do editor"><button class="top-action-button active" type="button" title="Preview"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 8h8M8 12h5M8 16h3"/></svg><span>Preview</span></button><button class="top-action-button" type="button" title="Terminal"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="m7 9 3 3-3 3M13 15h4"/></svg><span>Terminal</span></button><button class="top-action-button" type="button" title="Chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.7 8.7 0 0 1-3.3-.64L4 20l1.64-3.55A7.4 7.4 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/></svg><span>Chat</span></button><button class="profile-button" type="button" title="Perfil" aria-label="Perfil"><span>U</span></button></nav></header><div class="workspace-body"><nav class="workspace-activity" aria-label="Navegação do projeto"><button class="activity-button active" title="Explorador de arquivos" aria-label="Explorador de arquivos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z"/><path d="M3 10h18"/></svg></button><button class="activity-button" title="Git" aria-label="Git"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 7v10M8 5h4a6 6 0 0 1 6 6M16 12h-4"/></svg></button><button class="activity-button" title="Extensões" aria-label="Extensões"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3H5a2 2 0 0 0-2 2v4h4v2H3v4a2 2 0 0 0 2 2h4v-4h2v4h4a2 2 0 0 0 2-2v-4h-4V9h4V5a2 2 0 0 0-2-2h-4v4H9V3Z"/></svg></button><button class="activity-button" title="Security Problems" aria-label="Security Problems"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 7v5c0 4.8-3.2 7.7-9 9-5.8-1.3-9-4.2-9-9V7l9-4Z"/><path d="M12 8v4M12 16h.01"/></svg></button><span></span><button class="activity-button" id="workspace-settings" title="Configurações" aria-label="Configurações"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.08h-2.4v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.46 15a1.7 1.7 0 0 0-1.56-1.03h-.08v-2.4h.08A1.7 1.7 0 0 0 8.46 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.7-1.7.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.08h2.4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.7 1.7-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.08v2.4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg></button></nav>
  </div></div>`;
  workspace.querySelector('.workspace-body').insertAdjacentHTML('beforeend', `<aside class="workspace-sidebar"><div class="sidebar-title">EXPLORER <span>${currentReport.filesScanned}</span></div><section class="explorer-open-editors"><div class="explorer-section-heading">OPEN EDITORS</div><button class="open-editor-item" type="button"><i></i>${escapeHtml(firstFinding ? firstFinding.file.split(/[\\/]/).pop() : (files[0]?.file || 'README.md'))}</button></section><div class="file-tree"><div class="tree-folder">${escapeHtml(currentReport.projectName)}</div>${(files.length ? files : [{ file: 'Nenhum arquivo encontrado' }]).map((file) => `<button class="tree-file" data-file="${escapeHtml(file.file)}"><span class="file-dot"></span>${escapeHtml(file.file)}</button>`).join('')}</div><div class="sidebar-bottom"><span>ANALISE</span><strong>${currentReport.findings.length} achados</strong><small>${currentReport.durationMs} ms · ${currentReport.filesScanned} arquivos</small></div></aside><main class="workspace-editor"><div class="editor-tabs"><span class="editor-tab active"><i></i>${escapeHtml(firstFinding ? firstFinding.file.split(/[\\/]/).pop() : (files[0]?.file || 'README.md'))}</span></div><div class="editor-content"><div class="line-numbers">${Array.from({ length: Math.max(12, firstFinding ? firstFinding.line + 4 : 12) }, (_, index) => `<span>${index + 1}</span>`).join('')}</div><pre class="code-preview"><code>${escapeHtml(firstFinding ? firstFinding.excerpt : (files[0]?.content || '// Nenhum arquivo encontrado.'))}</code></pre></div><div class="editor-panel-label">PROBLEMS <span>${currentReport.findings.length}</span></div></main><aside class="security-panel"><div class="security-heading"><div><span class="panel-eyebrow">VUPPO SECURITY</span><h2>Security Problems</h2></div><span class="finding-total">${currentReport.findings.length}</span></div><div class="severity-summary"><span><b class="severity-critical">${counts.critical || 0}</b> critical</span><span><b class="severity-high">${counts.high || 0}</b> high</span><span><b class="severity-medium">${counts.medium || 0}</b> medium</span></div><div class="workspace-findings">${currentReport.findings.length ? currentReport.findings.map((finding, index) => `<button class="workspace-finding ${index === 0 ? 'selected' : ''}" data-finding-index="${index}"><span class="finding-severity ${finding.severity}"></span><span><strong>${escapeHtml(finding.title)}</strong><small>${escapeHtml(finding.file)}:${finding.line}</small></span></button>`).join('') : '<div class="workspace-empty-state">Nenhum risco encontrado pelas regras atuais.</div>'}</div></aside><footer class="workspace-statusbar"><span>main</span><span>${escapeHtml(currentReport.projectPath)}</span><span>${currentReport.scannedAt.slice(0, 10)} · ${currentReport.filesScanned} arquivos</span></footer>`);
  workspace.querySelector('.editor-tabs').innerHTML = '';
  activeMinimapRefresh = null;
  workspace.querySelector('.editor-content').innerHTML = '<div class="editor-empty"><img src="vuppo-icon.png" alt="Vuppo" /><span>Abra um arquivo para começar</span></div>';
  const fileTree = workspace.querySelector('.file-tree');
  if (files.length || (currentReport.directories || []).length) {
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
    (currentReport.directories || []).forEach((directory) => {
      let node = treeRoot;
      directory.split(/[\\/]/).filter(Boolean).forEach((folder) => {
        if (!node.folders.has(folder)) node.folders.set(folder, { folders: new Map(), files: [] });
        node = node.folders.get(folder);
      });
    });
    const renderTreeNode = (node, level = 0, parentPath = '') => `${[...node.folders.entries()].sort(([first], [second]) => compareTreeEntries(first, second)).map(([name, child]) => `<div class="tree-folder-item" style="--tree-level:${level}" data-folder="${escapeHtml(parentPath ? `${parentPath}/${name}` : name)}"><span class="tree-chevron">⌄</span><img src="assets/material-icons/folder.svg" class="tree-folder-icon" alt="" /><span class="tree-folder-label">${escapeHtml(name)}</span></div><div class="tree-children">${renderTreeNode(child, level + 1, parentPath ? `${parentPath}/${name}` : name)}</div>`).join('')}${node.files.sort((first, second) => compareTreeEntries(first.name, second.name)).map((file) => `<button class="tree-file" data-file="${escapeHtml(file.file)}" style="--tree-level:${level}" data-extension="${escapeHtml((file.name.includes('.') ? file.name.split('.').pop() : '').toLowerCase())}">${fileIconMarkup(file.name)}<span class="tree-file-label">${escapeHtml(file.name)}</span></button>`).join('')}`;
    fileTree.innerHTML = `<div class="tree-folder"><span class="tree-chevron">⌄</span><img src="assets/material-icons/folder-open.svg" class="tree-folder-icon" alt="" /><span class="tree-folder-label">${escapeHtml(currentReport.projectName)}</span></div><div class="tree-children root-children">${renderTreeNode(treeRoot)}</div>`;
  }
  const explorerTitle = workspace.querySelector('.sidebar-title');
  explorerTitle.innerHTML = '<span>EXPLORER</span><div class="explorer-actions"><button type="button" class="explorer-more" title="Mais ações" aria-label="Mais ações" aria-expanded="false">...</button><div class="explorer-menu hidden"><button type="button" data-explorer-action="collapse"><i class="codicon codicon-collapse-all" aria-hidden="true"></i><span>Recolher pastas</span></button><button type="button" data-explorer-action="new-folder"><i class="codicon codicon-new-folder" aria-hidden="true"></i><span>Nova pasta...</span></button><button type="button" data-explorer-action="new-file"><i class="codicon codicon-new-file" aria-hidden="true"></i><span>Novo arquivo...</span></button></div></div>';
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
  const closeExplorerMenu = () => {
    explorerMenu?.classList.add('hidden');
    explorerTitle.querySelector('.explorer-more')?.setAttribute('aria-expanded', 'false');
  };
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
      const folderIcon = folder.querySelector('.tree-folder-icon');
      if (folderIcon) folderIcon.src = 'assets/material-icons/folder.svg';
    });
    closeExplorerMenu();
  });
  explorerMenu?.querySelector('[data-explorer-action="new-folder"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    closeExplorerMenu();
    startExplorerCreate('folder', currentExplorerCreateTarget());
  });
  explorerMenu?.querySelector('[data-explorer-action="new-file"]')?.addEventListener('click', (event) => {
    event.stopPropagation();
    closeExplorerMenu();
    startExplorerCreate('file', currentExplorerCreateTarget());
  });
  workspace.querySelectorAll('.tree-folder-item').forEach((folder) => folder.addEventListener('click', (event) => {
    event.stopPropagation();
    workspace.querySelectorAll('.tree-folder-item.selected, .tree-file.selected').forEach((item) => item.classList.remove('selected'));
    folder.classList.add('selected');
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
  openEditorsMenu?.querySelector('[data-open-editor-action="close-all"]')?.addEventListener('click', () => [...workspace.querySelectorAll('.editor-tab')].forEach((tab) => closeEditorTab(tab.dataset.file)));
  $('#workspace-close')?.addEventListener('click', closeWorkspaceFolder);
  applySettings();
  openInitialWorkspaceFile(firstFinding, files);
}

// Abre o arquivo do primeiro achado (ou o primeiro arquivo) já no editor Monaco,
// para que o realce de sintaxe apareça assim que o projeto é analisado.
function openInitialWorkspaceFile(firstFinding, files) {
  if (!window.VuppoEditor) return;
  const initialFile = firstFinding?.file || files?.[0]?.file;
  if (!initialFile) return;
  try { selectWorkspaceFile(initialFile); } catch { /* mantém a prévia estática */ }
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

let editorTabsMenuGuardsInstalled = false;
let previewDeviceGuardsInstalled = false;

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
    if (action === 'save') saveActiveEditor();
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
  if (!editorTabsMenuGuardsInstalled) {
    editorTabsMenuGuardsInstalled = true;
    document.addEventListener('click', (event) => {
      const tabsMenu = document.querySelector('.editor-tabs-menu');
      if (!tabsMenu || tabsMenu.classList.contains('hidden')) return;
      if (tabsMenu.contains(event.target) || event.target.closest?.('.editor-tabs-menu-button')) return;
      tabsMenu.classList.add('hidden');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const tabsMenu = document.querySelector('.editor-tabs-menu');
      if (tabsMenu && !tabsMenu.classList.contains('hidden')) tabsMenu.classList.add('hidden');
    });
  }
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
    git: '<div class="workspace-side-view sc-view" data-side-view="git"><div class="sidebar-title">SOURCE CONTROL<i class="codicon codicon-git-commit sc-title-icon" aria-hidden="true"></i><button type="button" class="sc-refresh" title="Atualizar" aria-label="Atualizar"><i class="codicon codicon-refresh" aria-hidden="true"></i></button><button type="button" class="sc-more" title="Mais ações" aria-label="Mais ações"><i class="codicon codicon-ellipsis" aria-hidden="true"></i></button></div><div class="sc-body"></div></div>',
    extensions: '<div class="workspace-side-view" data-side-view="extensions"><div class="sidebar-title">EXTENSÕES</div><div class="workspace-view-empty"><strong>Extensões</strong><span>O catálogo estará disponível em breve.</span></div></div>',
    settings: '<div class="workspace-side-view" data-side-view="settings"><div class="sidebar-title">CONFIGURAÇÕES</div><div class="workspace-view-empty"><strong>Configurações</strong><span>Preferências do editor.</span></div></div>'
  };
  sidebar.insertAdjacentHTML('beforeend', sideViews.git + sideViews.extensions + sideViews.settings);
  editor.insertAdjacentHTML('beforeend', '<section class="workspace-feature-panel preview-panel hidden" data-feature-panel="preview"><div class="preview-browser-bar"><button type="button" class="preview-target">▣ <span>Desktop</span>⌄</button><div class="preview-url"><span>◉</span>http://localhost:3000</div><button type="button" aria-label="Atualizar preview"><span class="preview-refresh-icon">↻</span></button><button type="button" aria-label="Abrir preview em nova janela"><i class="codicon codicon-globe"></i></button><button type="button" class="feature-close" aria-label="Fechar Preview">×</button></div><div class="preview-empty"><div class="preview-browser-icon"><i></i><i></i><i></i><span></span></div><strong>No preview available</strong><span>Run your project to see the preview here.</span></div></section><section class="workspace-feature-panel terminal-panel hidden" data-feature-panel="terminal"><div class="terminal-heading"><div class="terminal-tabs"><button class="terminal-tab active" type="button">powershell</button></div><div class="terminal-controls"><button type="button" class="terminal-control terminal-new" title="Novo terminal" aria-label="Novo terminal">+</button><button type="button" class="terminal-control terminal-maximize" title="Maximizar terminal" aria-label="Maximizar terminal">□</button><button type="button" class="terminal-control terminal-trash" title="Fechar terminal" aria-label="Fechar terminal"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7l1-3h4l1 3"/></svg></button></div></div><div class="terminal-output"><span class="terminal-prompt">PS Vuppo&gt;</span><span class="terminal-cursor"></span></div></section><section class="workspace-feature-panel chat-panel hidden" data-feature-panel="chat"><header class="chat-heading"><div class="chat-title"><span class="chat-agent-icon">V</span><strong>Vuppo Chat</strong><span class="chat-status-dot"></span></div><div class="chat-heading-actions"><button type="button" class="chat-heading-button" title="Novo chat" aria-label="Novo chat">+</button><button type="button" class="feature-close" aria-label="Fechar Chat">Fechar</button></div></header><div class="chat-thread"><div class="chat-welcome"><span class="chat-welcome-icon">V</span><strong>Como posso ajudar?</strong><p>Analise o código, explique um achado ou sugira uma correção.</p></div></div><div class="chat-composer"><div class="chat-input"><span>Mensagem para Vuppo...</span><b>↑</b></div><div class="chat-composer-footer"><button type="button" class="chat-model">Vuppo Security <span>⌄</span></button><span class="chat-shortcut">Enter para enviar</span></div></div></section>');
  const previewPanel = editor.querySelector('[data-feature-panel="preview"]');
  const previewUrl = resolveProjectPreviewUrl();
  const previewPlaceholder = previewPanel.querySelector('.preview-empty');
  const previewTarget = previewPanel.querySelector('.preview-target');
  const renderPreviewTargetLabel = (device) => {
    const isMobile = device === 'mobile';
    previewTarget.innerHTML = `<span class="desktop-icon">${isMobile ? '▯' : '▣'}</span><span>${isMobile ? 'Mobile' : 'Desktop'}</span><b>⌄</b>`;
  };
  renderPreviewTargetLabel('desktop');
  previewPanel.querySelector('.preview-url').innerHTML = `<span class="globe-icon"></span><span class="preview-url-text">${previewUrl}</span>`;
  previewTarget.insertAdjacentHTML('afterend', '<div class="preview-device-menu hidden"><button type="button" data-preview-device="desktop" class="active">Desktop</button><button type="button" data-preview-device="mobile">Mobile</button></div>');
  const previewDeviceMenu = previewPanel.querySelector('.preview-device-menu');
  const applyPreviewDevice = (device) => {
    previewPanel.classList.toggle('is-mobile', device === 'mobile');
    renderPreviewTargetLabel(device);
    previewDeviceMenu.querySelectorAll('[data-preview-device]').forEach((button) => button.classList.toggle('active', button.dataset.previewDevice === device));
    previewDeviceMenu.classList.add('hidden');
  };
  previewTarget.addEventListener('click', (event) => {
    event.stopPropagation();
    previewDeviceMenu.classList.toggle('hidden');
  });
  previewDeviceMenu.querySelectorAll('[data-preview-device]').forEach((button) => {
    button.addEventListener('click', () => applyPreviewDevice(button.dataset.previewDevice));
  });
  if (!previewDeviceGuardsInstalled) {
    previewDeviceGuardsInstalled = true;
    document.addEventListener('click', (event) => {
      const menu = document.querySelector('.preview-device-menu');
      if (!menu || menu.classList.contains('hidden')) return;
      if (menu.contains(event.target) || event.target.closest?.('.preview-target')) return;
      menu.classList.add('hidden');
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelector('.preview-device-menu')?.classList.add('hidden');
    });
  }
  let previewWebview = previewPanel.querySelector('webview');
  if (!previewWebview) {
    previewWebview = document.createElement('webview');
    previewWebview.className = 'preview-webview';
    previewWebview.setAttribute('allowpopups', 'true');
    previewWebview.setAttribute('partition', 'persist:vuppo-preview');
    previewPanel.appendChild(previewWebview);
  }
  previewWebview.setAttribute('src', previewUrl);
  const refreshButton = previewPanel.querySelector('[aria-label="Atualizar preview"]');
  let refreshSpinnerTimer = 0;
  const stopRefreshSpinner = () => {
    clearTimeout(refreshSpinnerTimer);
    refreshButton?.classList.remove('is-refreshing');
  };
  previewWebview.addEventListener('did-finish-load', () => {
    stopRefreshSpinner();
    previewPlaceholder?.classList.add('hidden');
  });
  previewWebview.addEventListener('did-fail-load', (event) => {
    if (event?.errorCode === -3 || event?.isMainFrame === false) return;
    stopRefreshSpinner();
    previewPlaceholder?.classList.remove('hidden');
    const title = previewPlaceholder?.querySelector('strong');
    const text = previewPlaceholder?.querySelector('span');
    if (title) title.textContent = 'Preview indisponível';
    if (text) text.textContent = 'Inicie o projeto em http://localhost:3000 para visualizar a página.';
  });
  refreshButton?.addEventListener('click', () => {
    refreshButton.classList.remove('is-refreshing');
    void refreshButton.offsetWidth;
    refreshButton.classList.add('is-refreshing');
    clearTimeout(refreshSpinnerTimer);
    refreshSpinnerTimer = setTimeout(stopRefreshSpinner, 6000);
    previewPlaceholder?.classList.add('hidden');
    try {
      previewWebview.reload();
    } catch {
      previewWebview.setAttribute('src', `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}_vuppo=${Date.now()}`);
    }
  });
  previewPanel.querySelector('[aria-label="Abrir preview em nova janela"]')?.addEventListener('click', () => {
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  });
  const chatPanel = editor.querySelector('[data-feature-panel="chat"]');
  chatPanel.querySelector('.chat-title strong').textContent = 'Chat';
  chatPanel.querySelector('.chat-agent-icon')?.remove();
  chatPanel.querySelector('.chat-welcome-icon')?.remove();
  const chatHeadingActions = chatPanel.querySelector('.chat-heading-actions');
  chatHeadingActions.innerHTML = '<button type="button" class="chat-heading-button chat-new-button" title="Novo chat" aria-label="Novo chat"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button><button type="button" class="chat-heading-button chat-history-toggle" title="Histórico" aria-label="Histórico"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg></button>';
  chatPanel.querySelector('.chat-model')?.remove();
  const chatThread = chatPanel.querySelector('.chat-thread');
  chatThread.insertAdjacentHTML('beforeend', '<div class="chat-history hidden"><div class="chat-history-head"><strong>Histórico</strong><button type="button" class="chat-history-clear" title="Excluir todos os históricos" aria-label="Excluir todos os históricos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7l1-3h4l1 3"/></svg><span>Excluir todos</span></button></div><div class="chat-history-list"></div></div>');
  const chatInput = chatPanel.querySelector('.chat-input');
  chatInput.innerHTML = '<button type="button" class="chat-attach" title="Adicionar arquivo ou imagem" aria-label="Adicionar arquivo ou imagem">+</button><textarea rows="1" placeholder="Digite uma mensagem..." aria-label="Mensagem para o chat"></textarea><button type="button" class="chat-send" title="Enviar mensagem" aria-label="Enviar mensagem"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></svg></button><input class="chat-file-input" type="file" accept="image/*,.txt,.md,.json,.js,.ts,.html,.css" multiple hidden />';
  const chatHistory = chatPanel.querySelector('.chat-history');
  chatPanel.insertBefore(chatHistory, chatPanel.querySelector('.chat-composer'));
  const chatHistoryList = chatHistory.querySelector('.chat-history-list');
  const chatMessageInput = chatInput.querySelector('textarea');
  const chatFileInput = chatInput.querySelector('.chat-file-input');
  const chatHistoryToggle = chatPanel.querySelector('.chat-history-toggle');
  const chatComposer = chatPanel.querySelector('.chat-composer');
  renderChatContextChips();
  const hideChatHistory = () => {
    chatHistory.classList.add('hidden');
    chatThread.classList.remove('hidden');
    chatComposer.classList.remove('hidden');
    chatHistoryToggle.classList.remove('active');
  };
  const chatSessions = [];
  let activeChatSession = null;
  const chatSessionTitle = (session, fallbackIndex) => {
    const firstUser = session.messages.find((item) => item.className === 'chat-message-user');
    const base = (firstUser || session.messages[0])?.text || '';
    if (base) return base.length > 34 ? `${base.slice(0, 34)}…` : base;
    return `Chat ${fallbackIndex + 1}`;
  };
  const archiveActiveChatSession = () => {
    if (!activeChatSession?.messages.length || chatSessions.includes(activeChatSession)) return;
    chatSessions.unshift(activeChatSession);
    if (chatSessions.length > CHAT_HISTORY_LIMIT) chatSessions.length = CHAT_HISTORY_LIMIT;
  };
  const appendChatMessageElement = (text, className) => {
    const messageElement = document.createElement('div');
    messageElement.className = `chat-message ${className}`;
    messageElement.textContent = text;
    chatThread.appendChild(messageElement);
    chatThread.scrollTop = chatThread.scrollHeight;
    return messageElement;
  };
  const appendChatMessage = (message, className) => {
    if (!activeChatSession) activeChatSession = { id: `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: '', messages: [], createdAt: new Date() };
    activeChatSession.messages.push({ text: message, className });
    appendChatMessageElement(message, className);
  };
  const appendChatNotice = (text) => appendChatMessageElement(text, 'chat-message-system');
  const renderChatThread = (session) => {
    chatThread.querySelectorAll('.chat-message').forEach((message) => message.remove());
    if (!session) return;
    session.messages.forEach((item) => appendChatMessageElement(item.text, item.className));
  };
  const deleteChatSession = (session) => {
    if (getSettings().chatConfirmClearHistory !== false && !confirm('Excluir esta conversa do histórico?')) return;
    const index = chatSessions.indexOf(session);
    if (index >= 0) chatSessions.splice(index, 1);
    if (activeChatSession === session) {
      activeChatSession = null;
      renderChatThread(null);
      chatThread.scrollTop = 0;
    }
    renderChatHistory();
  };
  const renderChatHistory = () => {
    chatHistoryList.innerHTML = '';
    const entries = [];
    if (activeChatSession?.messages.length) entries.push({ session: activeChatSession, current: true });
    chatSessions.forEach((session) => {
      if (session !== activeChatSession) entries.push({ session, current: false });
    });
    if (!entries.length) {
      const empty = document.createElement('span');
      empty.className = 'chat-history-empty';
      empty.textContent = 'Nenhuma conversa salva ainda.';
      chatHistoryList.appendChild(empty);
      return;
    }
    entries.forEach((entry, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = `chat-history-item${entry.current ? ' active' : ''}`;
      const info = document.createElement('span');
      info.className = 'chat-history-item-info';
      const title = document.createElement('strong');
      title.textContent = chatSessionTitle(entry.session, index);
      const meta = document.createElement('span');
      const time = entry.session.createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      meta.textContent = `${entry.session.messages.length} mensagens · ${time}${entry.current ? ' · conversa atual' : ''}`;
      info.append(title, meta);
      const remove = document.createElement('span');
      remove.className = 'chat-history-item-delete';
      remove.setAttribute('role', 'button');
      remove.setAttribute('aria-label', 'Excluir conversa');
      remove.title = 'Excluir conversa';
      remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7l1-3h4l1 3"/></svg>';
      item.append(info, remove);
      item.addEventListener('click', (event) => {
        if (event.target.closest('.chat-history-item-delete')) {
          deleteChatSession(entry.session);
          return;
        }
        if (entry.session === activeChatSession) {
          hideChatHistory();
          return;
        }
        archiveActiveChatSession();
        activeChatSession = entry.session;
        renderChatThread(entry.session);
        hideChatHistory();
      });
      chatHistoryList.appendChild(item);
    });
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
    chatMessageInput.style.height = 'auto';
    chatMessageInput.style.height = `${Math.min(chatMessageInput.scrollHeight, 100)}px`;
  });
  chatInput.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    chatMessageInput.focus();
  });
  chatPanel.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    chatMessageInput.focus();
  });
  chatMessageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  });
  const toggleChatHistory = () => {
    const showing = chatHistory.classList.toggle('hidden');
    chatThread.classList.toggle('hidden', !showing);
    chatComposer.classList.toggle('hidden', !showing);
    chatHistoryToggle.classList.toggle('active', !showing);
    if (!showing) renderChatHistory();
  };
  chatPanel.querySelector('.chat-new-button').addEventListener('click', () => {
    const hadConversation = Boolean(activeChatSession?.messages.length);
    archiveActiveChatSession();
    activeChatSession = null;
    chatThread.querySelectorAll('.chat-message').forEach((message) => message.remove());
    if (hadConversation) appendChatNotice('Conversa anterior salva no histórico.');
    chatThread.scrollTop = 0;
    hideChatHistory();
  });
  chatHistoryToggle.addEventListener('click', toggleChatHistory);
  chatHistory.querySelector('.chat-history-clear').addEventListener('click', (event) => {
    event.stopPropagation();
    if (getSettings().chatConfirmClearHistory !== false && !confirm('Excluir todo o histórico de conversas do chat?')) return;
    chatSessions.length = 0;
    activeChatSession = null;
    renderChatThread(null);
    chatThread.scrollTop = 0;
    renderChatHistory();
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
    if (terminalPanel.classList.contains('hidden')) return;
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
      const wasFocused = document.activeElement === terminalScreen;
      terminalScreen.value = `${session.output}${session.inputBuffer}`;
      terminalScreen.scrollTop = terminalScreen.scrollHeight;
      if (wasFocused) {
        terminalScreen.setSelectionRange(terminalScreen.value.length, terminalScreen.value.length);
        updateTerminalCaret();
      }
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
    activeTerminalSession = null;
    terminalScreen.value = '';
    terminalInput.value = '';
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
  const addTerminalTab = () => {
    if (terminalTabs.children.length >= 7) return null;
    const usedNames = new Set([...terminalTabs.querySelectorAll('.terminal-tab-label')].map((label) => label.textContent));
    let terminalNumber = terminalTabs.children.length ? 2 : 1;
    while (usedNames.has(`Terminal ${terminalNumber}`)) terminalNumber += 1;
    const tab = document.createElement('button');
    tab.className = 'terminal-tab';
    tab.type = 'button';
    tab.innerHTML = `<span class="terminal-tab-label">Terminal ${terminalNumber}</span><span class="terminal-tab-close" role="button" aria-label="Remover sessão">×</span>`;
    terminalTabs.appendChild(tab);
    createTerminalSession(tab);
    activateTerminal(tab);
    updateTerminalLimit();
    return tab;
  };
  terminalPanel.querySelector('.terminal-new').addEventListener('click', () => {
    addTerminalTab();
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
  workspace.querySelector('.workspace-topbar').insertAdjacentHTML('beforeend', '<div class="profile-menu hidden"><strong>Perfil</strong><span>Conta local Vuppo</span><button type="button" class="profile-menu-item" data-profile-action="settings" title="Configurações"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.7 1.7-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56v.08h-2.4v-.08a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.7-1.7.06-.06A1.7 1.7 0 0 0 8.46 15a1.7 1.7 0 0 0-1.56-1.03h-.08v-2.4h.08A1.7 1.7 0 0 0 8.46 10a1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.7-1.7.06.06a1.7 1.7 0 0 0 1.88.34 1.7 1.7 0 0 0 1.03-1.56v-.08h2.4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.7 1.7-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.56 1.03h.08v2.4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg><span>Configurações</span></button><button type="button" class="profile-close">Fechar</button></div>');
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
        workspace.querySelector('[data-profile-action="settings"]')?.classList.remove('active');
        if (button) button.classList.add('active');
        return;
      }
      const isSameView = button ? sidebar.dataset.sideView === view && !sidebar.classList.contains('is-collapsed') : false;
      sidebar.dataset.sideView = isSameView ? '' : view;
      sidebar.classList.toggle('is-collapsed', isSameView);
      body.classList.toggle('sidebar-closed', isSameView);
      workspace.querySelector('[data-profile-action="settings"]')?.classList.toggle('active', !isSameView && view === 'settings');
      workspace.querySelectorAll('.activity-button').forEach((item) => item.classList.remove('active'));
      if (!isSameView && button) button.classList.add('active');
  };
  workspace.querySelectorAll('.activity-button').forEach((button) => {
    const title = button.getAttribute('title');
    const view = title === 'Explorador de arquivos' ? 'explorer' : title === 'Git' ? 'git' : title === 'Extensões' ? 'extensions' : title === 'Configurações' ? 'settings' : 'security';
    button.addEventListener('click', () => {
      if (view === 'settings') {
        openVuppoSettings();
        return;
      }
      openWorkspaceView(view, button);
    });
  });
  workspace.querySelectorAll('[data-workspace-view]').forEach((button) => {
    button.addEventListener('click', () => {
      openWorkspaceView(button.dataset.workspaceView, null);
      button.closest('.workspace-menu').classList.remove('is-open');
      button.closest('.workspace-menu').querySelector('.workspace-menu-button').setAttribute('aria-expanded', 'false');
    });
  });
  const fileTree = workspace.querySelector('.file-tree');
  const treeContextMenu = document.createElement('div');
  treeContextMenu.className = 'tree-context-menu hidden';
  treeContextMenu.setAttribute('role', 'menu');
  treeContextMenu.setAttribute('aria-label', 'Ações do explorador');
  treeContextMenu.innerHTML = [
    '<button type="button" role="menuitem" data-tree-action="new-file"><i class="codicon codicon-new-file" aria-hidden="true"></i><span>Novo arquivo...</span></button>',
    '<button type="button" role="menuitem" data-tree-action="new-folder"><i class="codicon codicon-new-folder" aria-hidden="true"></i><span>Nova pasta...</span></button>',
    '<div class="tree-context-separator" role="separator"></div>',
    '<button type="button" role="menuitem" data-tree-action="add-to-chat"><i class="codicon codicon-comment-discussion" aria-hidden="true"></i><span>Adicionar ao chat</span></button>',
    '<button type="button" role="menuitem" data-tree-action="copy"><i class="codicon codicon-copy" aria-hidden="true"></i><span>Copiar</span></button>',
    '<button type="button" role="menuitem" data-tree-action="paste"><i class="codicon codicon-clippy" aria-hidden="true"></i><span>Colar</span></button>',
    '<div class="tree-context-separator" data-tree-separator="item" role="separator"></div>',
    '<button type="button" role="menuitem" data-tree-action="rename"><i class="codicon codicon-edit" aria-hidden="true"></i><span>Renomear...</span></button>',
    '<button type="button" role="menuitem" data-tree-action="delete"><i class="codicon codicon-trash" aria-hidden="true"></i><span>Excluir</span></button>',
    '<button type="button" role="menuitem" data-tree-action="refresh"><i class="codicon codicon-refresh" aria-hidden="true"></i><span>Atualizar</span></button>'
  ].join('');
  workspace.appendChild(treeContextMenu);
  const hideTreeContextMenu = () => treeContextMenu.classList.add('hidden');
  const selectTreeRow = (row) => {
    workspace.querySelectorAll('.tree-folder-item.selected, .tree-file.selected').forEach((item) => item.classList.remove('selected'));
    row?.classList.add('selected');
  };
  const setTreeMenuContext = (isItem, isFolder) => {
    treeContextMenu.querySelectorAll('[data-tree-action]').forEach((button) => {
      const action = button.dataset.treeAction;
      let visible = true;
      if (['add-to-chat', 'copy', 'rename', 'delete'].includes(action)) visible = isItem;
      else if (action === 'paste') visible = !isItem || isFolder;
      else if (action === 'refresh') visible = !isItem;
      button.classList.toggle('hidden', !visible);
      if (action === 'paste') button.disabled = !explorerClipboard;
    });
    treeContextMenu.querySelectorAll('[data-tree-separator]').forEach((separator) => {
      separator.classList.toggle('hidden', separator.dataset.treeSeparator === 'item' && !isItem);
    });
  };
  const showTreeContextMenu = (targetFolder, x, y, context = {}) => {
    treeContextMenu.dataset.targetFolder = normalizeTreePath(targetFolder);
    treeContextMenu.dataset.targetEntry = context.relativePath || '';
    treeContextMenu.dataset.targetIsFolder = String(Boolean(context.isFolder));
    setTreeMenuContext(Boolean(context.relativePath), Boolean(context.isFolder));
    treeContextMenu.style.left = '0px';
    treeContextMenu.style.top = '0px';
    treeContextMenu.classList.remove('hidden');
    const bounds = treeContextMenu.getBoundingClientRect();
    treeContextMenu.style.left = `${Math.min(Math.max(8, x), Math.max(8, window.innerWidth - bounds.width - 8))}px`;
    treeContextMenu.style.top = `${Math.min(Math.max(8, y), Math.max(8, window.innerHeight - bounds.height - 8))}px`;
  };
  fileTree?.addEventListener('contextmenu', (event) => {
    if (event.target.closest('input, textarea, [contenteditable="true"], .tree-create-row')) return;
    const folderRow = event.target.closest('.tree-folder-item');
    const fileButton = event.target.closest('.tree-file');
    event.preventDefault();
    if (fileButton) {
      selectTreeRow(fileButton);
      showTreeContextMenu(parentTreePath(fileButton.dataset.file), event.clientX, event.clientY, { relativePath: fileButton.dataset.file, isFolder: false });
      return;
    }
    selectTreeRow(folderRow || null);
    showTreeContextMenu(folderRow ? folderRow.dataset.folder : '', event.clientX, event.clientY, folderRow ? { relativePath: folderRow.dataset.folder, isFolder: true } : {});
  });
  fileTree?.addEventListener('scroll', hideTreeContextMenu);
  treeContextMenu.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-tree-action]')?.dataset.treeAction;
    if (!action) return;
    const targetFolder = treeContextMenu.dataset.targetFolder || '';
    const targetEntry = treeContextMenu.dataset.targetEntry || '';
    const targetIsFolder = treeContextMenu.dataset.targetIsFolder === 'true';
    hideTreeContextMenu();
    switch (action) {
      case 'new-file': startExplorerCreate('file', targetFolder); break;
      case 'new-folder': startExplorerCreate('folder', targetFolder); break;
      case 'add-to-chat': addExplorerEntryToChat(targetEntry, targetIsFolder); break;
      case 'copy': await copyExplorerEntry(targetEntry, targetIsFolder); break;
      case 'paste': await pasteExplorerEntry(targetFolder); break;
      case 'rename': startExplorerRename(targetEntry); break;
      case 'delete': await deleteExplorerEntry(targetEntry); break;
      case 'refresh': await analyzeProject(currentReport.projectPath); break;
      default: break;
    }
  });
  document.addEventListener('keydown', (event) => {
    if (activeInlineCreate) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"]')) return;
    const selectedRow = workspace.querySelector('.tree-folder-item.selected, .tree-file.selected');
    if (!selectedRow || !document.body.contains(selectedRow)) return;
    const relativePath = selectedRow.dataset.folder || selectedRow.dataset.file;
    if (event.key === 'F2') {
      event.preventDefault();
      startExplorerRename(relativePath);
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      deleteExplorerEntry(relativePath);
    }
  });
  document.addEventListener('click', (event) => { if (!treeContextMenu.contains(event.target)) hideTreeContextMenu(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hideTreeContextMenu(); });
  const recentMenu = document.createElement('div');
  recentMenu.className = 'recent-menu hidden';
  workspace.appendChild(recentMenu);
  const hideRecentMenu = () => recentMenu.classList.add('hidden');
  const showRecentMenu = (anchor) => {
    const recent = readRecentProjects();
    recentMenu.innerHTML = recent.length
      ? recent.map((projectPath) => `<button type="button" class="recent-item" data-recent-project="${escapeHtml(projectPath)}"><span class="recent-item-name">${escapeHtml(projectPath.split(/[\\/]/).filter(Boolean).pop() || projectPath)}</span><small>${escapeHtml(projectPath)}</small></button>`).join('')
      : '<span class="recent-empty">Nenhum projeto recente.</span>';
    recentMenu.querySelectorAll('[data-recent-project]').forEach((item) => item.addEventListener('click', async () => {
      hideRecentMenu();
      try {
        await analyzeProject(item.dataset.recentProject);
      } catch (error) {
        alert(error.message || 'Não foi possível abrir o projeto recente.');
      }
    }));
    const bounds = anchor.getBoundingClientRect();
    recentMenu.style.top = `${bounds.bottom + 4}px`;
    recentMenu.style.left = `${Math.max(8, bounds.left)}px`;
    recentMenu.classList.remove('hidden');
  };
  const runFileAction = async (action, button) => {
    switch (action) {
      case 'new-file': startExplorerCreate('file'); break;
      case 'new-window': await window.vuppo.openNewWindow(); break;
      case 'open-file': await openFileFromDialog(); break;
      case 'open-folder':
      case 'open-project': await chooseProject(); break;
      case 'open-recent':
        if (recentMenu.classList.contains('hidden')) showRecentMenu(button);
        else hideRecentMenu();
        break;
      case 'save':
      case 'save-all': saveActiveEditor(); break;
      case 'save-as': await saveActiveEditorAs(); break;
      case 'close-editor': closeActiveEditor(); break;
      case 'close-folder': closeWorkspaceFolder(); break;
      case 'exit': window.vuppo.closeWindow(); break;
      default: hideRecentMenu(); break;
    }
  };
  workspace.querySelectorAll('[data-file-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const menu = button.closest('.workspace-menu');
      menu?.classList.remove('is-open');
      menu?.querySelector('.workspace-menu-button')?.setAttribute('aria-expanded', 'false');
      await runFileAction(button.dataset.fileAction, button);
    });
  });
  syncWorkspaceFileMenu();
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
        if (panel.classList.contains('hidden')) panel.querySelector('.preview-device-menu')?.classList.add('hidden');
        button.classList.toggle('active', !isOpen);
        if (feature === 'terminal' && isOpen === false) {
          if (!terminalTabs.children.length) addTerminalTab();
          focusTerminal();
        }
        if (feature === 'chat' && isOpen === false) {
          chatMessageInput.focus();
          setTimeout(() => chatMessageInput.focus(), 80);
        }
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
    panel.querySelector('.preview-device-menu')?.classList.add('hidden');
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
      icon.className = `window-icon ${isMaximized ? 'restore-icon' : 'maximize-icon'}`;
    }
    maximizeButton.title = isMaximized ? 'Restaurar' : 'Maximizar';
    maximizeButton.setAttribute('aria-label', isMaximized ? 'Restaurar' : 'Maximizar');
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
  profileMenu.querySelector('[data-profile-action="settings"]').addEventListener('click', () => {
    profileMenu.classList.add('hidden');
    openVuppoSettings();
  });
  profileMenu.querySelector('.profile-close').addEventListener('click', () => profileMenu.classList.add('hidden'));
  setupSourceControlView(workspace);
}

function getGitChanges() {
  const changes = currentReport.gitChanges || [];
  const showUntracked = getSettings().gitShowUntracked !== false;
  return {
    staged: changes.filter((change) => !change.untracked && change.x !== ' ' && change.x !== '?'),
    unstaged: changes.filter((change) => (showUntracked || !change.untracked) && (change.untracked || change.y !== ' ' || change.y === '?')),
  };
}

function gitStatusLabel(change) {
  const codes = { M: 'M', A: 'A', D: 'D', U: 'U', R: 'R', C: 'C', '?': 'U' };
  const code = change.untracked ? '?' : (change.x !== ' ' && change.x !== '?' ? change.x : change.y);
  return codes[code] || code;
}

function gitStatusClass(change) {
  const code = change.untracked ? '?' : (change.x !== ' ' && change.x !== '?' ? change.x : change.y);
  if (code === 'D') return 'deleted';
  if (code === 'A' || code === '?' || code === 'U') return 'added';
  return 'modified';
}

function renderSourceControlView() {
  const scBody = document.querySelector('.workspace-sidebar .sc-body');
  if (!scBody || !currentReport) return;
  const status = currentReport.gitStatus;
  if (!status) { scBody.innerHTML = '<div class="sc-loading">Carregando…</div>'; return; }
  if (!status.isRepo) {
    scBody.innerHTML = '<div class="sc-empty-repo"><button type="button" class="sc-button sc-init" title="Inicializar repositório">Inicializar repositório</button><span class="sc-empty-copy">Para melhor gerenciar as alterações do seu workspace, é preciso inicializar um repositório.</span></div>';
    scBody.querySelector('.sc-init').addEventListener('click', async () => {
      try {
        await window.vuppo.gitInit(currentReport.projectPath);
        await refreshSourceControl();
      } catch (error) {
        alert(error.message || 'Não foi possível inicializar o repositório.');
      }
    });
    return;
  }
  renderSourceControlChanges(scBody);
}

function renderSourceControlChanges(scBody) {
  const { staged, unstaged } = getGitChanges();
  const status = currentReport.gitStatus;
  const hasChanges = staged.length + unstaged.length > 0;
  const row = (change, index, section) => {
    const label = section === 'staged' ? (change.untracked ? 'A' : change.x) : (change.untracked ? 'U' : change.y);
    const actions = section === 'staged'
      ? '<button type="button" class="sc-row-action" data-sc-action="unstage" title="Retirar do stage"><i class="codicon codicon-cloud-download" aria-hidden="true"></i></button><button type="button" class="sc-row-action" data-sc-action="discard" title="Descartar alterações"><i class="codicon codicon-discard" aria-hidden="true"></i></button>'
      : '<button type="button" class="sc-row-action" data-sc-action="stage" title="Adicionar ao stage"><i class="codicon codicon-add" aria-hidden="true"></i></button><button type="button" class="sc-row-action" data-sc-action="discard" title="Descartar alterações"><i class="codicon codicon-discard" aria-hidden="true"></i></button>';
    const name = change.path.split(/[\\/]/).pop();
    const folder = change.path.split(/[\\/]/).slice(0, -1).join('/');
    return `<div class="sc-row" data-sc-section="${section}" data-sc-index="${index}" title="${escapeHtml(change.path)}"><span class="sc-file-name">${escapeHtml(name)}</span><span class="sc-file-path">${escapeHtml(folder)}</span>${actions}<span class="sc-badge sc-badge-${gitStatusClass(change)}">${escapeHtml(label)}</span></div>`;
  };
  scBody.innerHTML = `
    <div class="sc-commit-box">
      <div class="sc-branch-row"><i class="codicon codicon-git-branch" aria-hidden="true"></i><span>${escapeHtml(status.branch || 'main')}</span><span class="sc-branch-count">${hasChanges ? staged.length + unstaged.length : ''}</span></div>
      <textarea class="sc-message" rows="1" placeholder="Mensagem de commit (Ctrl+Enter para commit)" aria-label="Mensagem de commit"></textarea>
      <button type="button" class="sc-button sc-commit" ${hasChanges ? '' : 'disabled'}><i class="codicon codicon-check" aria-hidden="true"></i><span>Commit</span></button>
    </div>
    <div class="sc-sections">
      ${staged.length ? `<div class="sc-section"><div class="sc-section-header"><span>Staged Changes</span><span class="sc-section-count">${staged.length}</span></div>${staged.map((change, index) => row(change, index, 'staged')).join('')}</div>` : ''}
      ${unstaged.length ? `<div class="sc-section"><div class="sc-section-header"><span>Changes</span><span class="sc-section-count">${unstaged.length}</span></div>${unstaged.map((change, index) => row(change, index, 'unstaged')).join('')}</div>` : ''}
      ${!hasChanges ? '<div class="sc-no-changes"><i class="codicon codicon-check-all" aria-hidden="true"></i><span>Nenhuma alteração pendente.</span></div>' : ''}
    </div>`;
  const messageInput = scBody.querySelector('.sc-message');
  const commitButton = scBody.querySelector('.sc-commit');
  const runCommit = async () => {
    const message = messageInput.value.trim();
    if (!message) { messageInput.focus(); return; }
    const { staged } = getGitChanges();
    const allChanges = currentReport.gitChanges || [];
    const smartCommit = getSettings().gitSmartCommit === true && staged.length === 0 && allChanges.length > 0;
    const confirmation = smartCommit
      ? `Nada está no Stage. Adicionar ${allChanges.length} arquivo(s) automaticamente e criar o commit?`
      : `Criar o commit com ${staged.length} arquivo(s) preparado(s)?`;
    if (getSettings().gitConfirmCommit === true && !confirm(confirmation)) return;
    commitButton.disabled = true;
    try {
      if (smartCommit) {
        for (const change of allChanges) {
          await window.vuppo.gitStage({ projectPath: currentReport.projectPath, path: change.path, untracked: change.untracked });
        }
      }
      await window.vuppo.gitCommit({ projectPath: currentReport.projectPath, message });
      messageInput.value = '';
      await refreshSourceControl();
    } catch (error) {
      alert(error.message || 'Não foi possível fazer o commit.');
      commitButton.disabled = false;
    }
  };
  commitButton.addEventListener('click', runCommit);
  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      runCommit();
    }
  });
  scBody.querySelectorAll('.sc-row').forEach((rowElement) => {
    rowElement.addEventListener('click', async (event) => {
      const action = event.target.closest('[data-sc-action]')?.dataset.scAction;
      if (!action) return;
      const change = (rowElement.dataset.scSection === 'staged' ? staged : unstaged)[Number(rowElement.dataset.scIndex)];
      if (!change) return;
      const params = { projectPath: currentReport.projectPath, path: change.path, untracked: change.untracked };
      try {
        if (action === 'stage') await window.vuppo.gitStage(params);
        else if (action === 'unstage') await window.vuppo.gitUnstage(params);
        else if (action === 'discard' && (!getSettings().gitConfirmDiscard || confirm(`Deseja descartar as alterações em ${change.path}?`))) await window.vuppo.gitDiscard(params);
        else return;
        await refreshSourceControl();
      } catch (error) {
        alert(error.message || 'Não foi possível executar a ação do Git.');
        await refreshSourceControl();
      }
    });
  });
}

async function refreshSourceControl() {
  if (!currentReport?.projectPath) return;
  try {
    const status = await window.vuppo.gitStatus(currentReport.projectPath);
    currentReport.gitStatus = status;
    currentReport.gitChanges = status.changes;
  } catch {
    currentReport.gitStatus = { isRepo: false, branch: '', changes: [] };
    currentReport.gitChanges = [];
  }
  renderSourceControlView();
}

let sourceControlFocusBound = false;

function setupSourceControlView(workspace) {
  const refreshButton = workspace.querySelector('.sc-refresh');
  if (!refreshButton) return;
  refreshButton.addEventListener('click', () => refreshSourceControl());
  workspace.querySelector('.sc-more')?.addEventListener('click', () => refreshSourceControl());
  refreshSourceControl();
  workspace.querySelectorAll('[data-workspace-view="git"], .activity-button[title="Git"]').forEach((button) => {
    button.addEventListener('click', () => refreshSourceControl());
  });
  if (!sourceControlFocusBound) {
    sourceControlFocusBound = true;
    window.addEventListener('focus', () => {
      if (getSettings().gitAutoRefresh === false) return;
      if (!document.querySelector('.workspace:not(.hidden)')) return;
      refreshSourceControl();
    });
  }
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

function syncWorkspaceFileMenu() {
  const workspace = document.querySelector('.workspace');
  if (!workspace) return;
  const hasOpenEditor = Boolean(workspace.querySelector('.editor-tab'));
  const canSave = hasOpenEditor && (Boolean(workspace.querySelector('.code-editor')) || Boolean(window.VuppoEditor?.isOpen()));
  const state = { save: canSave, 'save-as': canSave, 'save-all': canSave, 'close-editor': hasOpenEditor };
  Object.entries(state).forEach(([action, enabled]) => {
    const button = workspace.querySelector(`[data-file-action="${action}"]`);
    if (button) button.disabled = !enabled;
  });
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
  syncWorkspaceFileMenu();
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
  window.VuppoEditor?.close(file);
  const wasActive = tab.classList.contains('active');
  tab.remove();
  updateEditorTabsMenuVisibility();
  syncWorkspaceFileMenu();
  if (!wasActive) return;
  const nextTab = tabs.querySelector('.editor-tab:last-child');
  if (nextTab) selectWorkspaceFile(nextTab.dataset.file);
  else {
    activeMinimapRefresh = null;
    window.VuppoEditor?.disposeAll();
    document.querySelector('.editor-content').innerHTML = '<div class="editor-empty"><img src="vuppo-icon.png" alt="Vuppo" /><span>Abra um arquivo para começar</span></div>';
  }
}

function closeActiveEditor() {
  const activeTab = document.querySelector('.editor-tab.active');
  if (activeTab) closeEditorTab(activeTab.dataset.file);
}

function renderWorkspaceFile(fileData, findingLine, fallbackText) {
  const editorContent = document.querySelector('.editor-content');
  if (!editorContent || !fileData) return;
  activeMinimapRefresh = null;
  if (fileData.isImage) {
    editorContent.innerHTML = fileData.content
      ? `<div class="image-preview"><header class="image-preview-heading"><span class="image-preview-name">${escapeHtml(fileData.file.split(/[\\/]/).pop())}</span><button class="image-preview-close" type="button" title="Fechar imagem" aria-label="Fechar imagem">×</button></header><img src="${fileData.content}" alt="${escapeHtml(fileData.file)}" /><span>${escapeHtml(fileData.file)}</span></div>`
      : `<div class="image-preview image-preview-empty"><header class="image-preview-heading"><span class="image-preview-name">${escapeHtml(fileData.file.split(/[\\/]/).pop())}</span><button class="image-preview-close" type="button" title="Fechar imagem" aria-label="Fechar imagem">×</button></header><strong>Imagem muito grande para a prévia</strong><span>Abra o arquivo para visualizar a imagem.</span></div>`;
    window.VuppoEditor?.disposeAll();
    editorContent.querySelector('.image-preview-close')?.addEventListener('click', closeActiveEditor);
    return;
  }
  const content = fileData.content ?? fallbackText ?? '// Arquivo sem conteúdo legível.';
  const safeContent = typeof content === 'string' && content.trim().length > 0 ? content : (fallbackText || '// Arquivo vazio ou não legível.');
  if (window.VuppoEditor) {
    window.VuppoEditor.open(editorContent, {
      file: fileData.file,
      value: safeContent,
      line: findingLine,
      projectPath: currentReport?.projectPath || '',
      language: window.VuppoEditor.languageFor(fileData.file),
      settings: getSettings(),
      onChange: (value) => { fileData.content = value; },
      onSave: async (value) => {
        fileData.content = value;
        if (fileData.external) await window.vuppo.writeFilePath({ filePath: fileData.absoluteFile, content: value });
        else await window.vuppo.writeFile({ projectPath: currentReport.projectPath, filePath: fileData.absoluteFile, content: value });
      },
      onSaveError: (error) => alert(error.message || 'Não foi possível salvar o arquivo.'),
      fallback: () => renderLegacyFileEditor(editorContent, fileData, findingLine, fallbackText, safeContent),
    });
    return;
  }
  renderLegacyFileEditor(editorContent, fileData, findingLine, fallbackText, safeContent);
}

// Editor legado (contenteditable) — usado apenas se o Monaco não puder carregar.
function renderLegacyFileEditor(editorContent, fileData, findingLine, fallbackText, safeContent) {
  const lineCount = safeContent.split(/\r?\n/).length;
  editorContent.innerHTML = `<div class="line-numbers">${Array.from({ length: Math.max(12, findingLine || lineCount, lineCount) }, (_, line) => `<span>${line + 1}</span>`).join('')}</div><div class="code-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Editor de código" spellcheck="false"></div><div class="minimap" aria-hidden="true"><canvas class="minimap-canvas"></canvas><div class="minimap-viewport"></div></div>`;
  const codeEditor = editorContent.querySelector('.code-editor');
  const lineNumbers = editorContent.querySelector('.line-numbers');
  const minimap = editorContent.querySelector('.minimap');
  const minimapCanvas = editorContent.querySelector('.minimap-canvas');
  const minimapViewport = editorContent.querySelector('.minimap-viewport');
  codeEditor.textContent = safeContent;
  codeEditor.tabIndex = 0;
  codeEditor.focus();
  const MINIMAP_BASE_WIDTH = DEFAULT_SETTINGS.editorMinimapWidth;
  const MINIMAP_LINE_HEIGHT = 3;
  const MINIMAP_CHAR_WIDTH = 2;
  const MINIMAP_FONT_SIZE = 4;
  const minimapScale = () => getMinimapWidth() / MINIMAP_BASE_WIDTH;
  const drawMinimap = () => {
    const lines = codeEditor.innerText.replace(/\r\n/g, '\n').split('\n');
    const width = getMinimapWidth();
    const scale = minimapScale();
    const fontSize = MINIMAP_FONT_SIZE * scale;
    const lineHeight = MINIMAP_LINE_HEIGHT * scale;
    const charWidth = MINIMAP_CHAR_WIDTH * scale;
    const height = Math.min(lines.length * lineHeight + fontSize, 6000);
    const ratio = window.devicePixelRatio || 1;
    minimapCanvas.width = width * ratio;
    minimapCanvas.height = height * ratio;
    minimapCanvas.style.width = `${width}px`;
    minimapCanvas.style.height = `${height}px`;
    const context = minimapCanvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.font = `${fontSize}px Consolas, monospace`;
    context.textBaseline = 'top';
    const keywordColor = '#569cd6';
    const stringColor = '#ce9178';
    const commentColor = '#6a9955';
    const numberColor = '#b5cea8';
    const defaultColor = '#9cdcfe';
    lines.forEach((line, index) => {
      const trimmed = line.trimStart();
      if (!trimmed) return;
      const indent = (line.length - trimmed.length) * charWidth;
      const y = index * lineHeight;
      let x = Math.min(indent, width - 4 * scale);
      const isComment = /^(\/\/|\/\*|\*|#)/.test(trimmed);
      const tokens = trimmed.match(/("[^"]*"|'[^']*'|`[^`]*`)|(\b\d+(?:\.\d+)?\b)|(\b(?:function|const|let|var|return|if|else|for|while|import|export|from|class|new|async|await|try|catch|throw|typeof|this|def|public|private|static|void|int|string|bool)\b)|(\w+|\S)/g) || [];
      tokens.forEach((token) => {
        if (x >= width) return;
        let color = defaultColor;
        if (isComment) color = commentColor;
        else if (/^["'`]/.test(token)) color = stringColor;
        else if (/^\d/.test(token)) color = numberColor;
        else if (/^(function|const|let|var|return|if|else|for|while|import|export|from|class|new|async|await|try|catch|throw|typeof|this|def|public|private|static|void|int|string|bool)$/.test(token)) color = keywordColor;
        else if (/^[A-Z]/.test(token)) color = '#4ec9b0';
        context.fillStyle = color;
        context.fillText(token, x, y + 0.5);
        x += context.measureText(token).width + scale;
      });
    });
    updateMinimapViewport();
  };
  const updateMinimapViewport = () => {
    const scrollHeight = codeEditor.scrollHeight || 1;
    const clientHeight = codeEditor.clientHeight || 1;
    const canvasHeight = parseFloat(minimapCanvas.style.height) || 0;
    if (!canvasHeight || !scrollHeight || scrollHeight <= clientHeight) {
      minimapViewport.style.display = 'none';
      return;
    }
    minimapViewport.style.display = 'block';
    const scale = minimapScale();
    const contentLines = scrollHeight / parseFloat(getComputedStyle(codeEditor).lineHeight || 18);
    const totalMinimapHeight = contentLines * MINIMAP_LINE_HEIGHT * scale;
    const viewportTop = (codeEditor.scrollTop / scrollHeight) * Math.min(canvasHeight, totalMinimapHeight);
    const viewportHeight = (clientHeight / scrollHeight) * Math.min(canvasHeight, totalMinimapHeight);
    minimapViewport.style.top = `${Math.max(0, viewportTop)}px`;
    minimapViewport.style.height = `${Math.max(14 * scale, viewportHeight)}px`;
  };
  const minimapScrollTo = (clientY) => {
    const bounds = minimap.getBoundingClientRect();
    const canvasHeight = parseFloat(minimapCanvas.style.height) || 1;
    const ratio = Math.min(1, Math.max(0, (clientY - bounds.top) / Math.max(1, Math.min(bounds.height, canvasHeight))));
    codeEditor.scrollTop = ratio * (codeEditor.scrollHeight - codeEditor.clientHeight);
  };
  let minimapDragging = false;
  minimap.addEventListener('mousedown', (event) => {
    minimapDragging = true;
    minimapScrollTo(event.clientY);
    event.preventDefault();
  });
  window.addEventListener('mousemove', (event) => { if (minimapDragging) minimapScrollTo(event.clientY); });
  window.addEventListener('mouseup', () => { minimapDragging = false; });
  new ResizeObserver(() => { updateMinimapViewport(); }).observe(codeEditor);
  activeMinimapRefresh = drawMinimap;
  drawMinimap();

  codeEditor.addEventListener('scroll', () => {
    lineNumbers.style.transform = `translateY(${-codeEditor.scrollTop}px)`;
    updateMinimapViewport();
  });
  codeEditor.addEventListener('input', () => {
    const editedContent = codeEditor.innerText.replace(/\r\n/g, '\n');
    const lines = editedContent.split('\n').length;
    lineNumbers.innerHTML = Array.from({ length: Math.max(12, lines) }, (_, line) => `<span>${line + 1}</span>`).join('');
    fileData.content = editedContent;
    drawMinimap();
    if (getSettings().autoSave === 'afterDelay') {
      clearTimeout(codeEditor._vuppoAutoSaveTimer);
      codeEditor._vuppoAutoSaveTimer = setTimeout(() => codeEditor.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true })), Number(getSettings().autoSaveDelay) || 1000);
    }
  });
  codeEditor.addEventListener('keydown', async (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      try {
        const content = codeEditor.innerText.replace(/\r\n/g, '\n');
        if (fileData.external) await window.vuppo.writeFilePath({ filePath: fileData.absoluteFile, content });
        else await window.vuppo.writeFile({ projectPath: currentReport.projectPath, filePath: fileData.absoluteFile, content });
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

function loadSettings() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}');
    return { ...DEFAULT_SETTINGS, ...(stored && typeof stored === 'object' ? stored : {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function getSettings() {
  return settings;
}

function saveSettings() {
  try { window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)); } catch { /* armazenamento indisponível */ }
}

function findSettingOption(key) {
  return SETTINGS_SCHEMA.flatMap((category) => category.options).find((option) => option.key === key) || null;
}

function normalizeSettingValue(option, value) {
  if (!option) return value;
  if (option.type === 'checkbox') return Boolean(value);
  if (option.type === 'number') {
    let parsed = Number(value);
    if (!Number.isFinite(parsed)) parsed = DEFAULT_SETTINGS[option.key];
    const min = option.min ?? parsed;
    const max = option.max ?? parsed;
    return Math.min(Math.max(parsed, min), max);
  }
  if (option.type === 'select') return option.choices.some(([stored]) => stored === value) ? value : DEFAULT_SETTINGS[option.key];
  return value;
}

function getMinimapWidth() {
  const width = normalizeSettingValue(findSettingOption('editorMinimapWidth'), settings.editorMinimapWidth);
  return Number.isFinite(width) ? width : DEFAULT_SETTINGS.editorMinimapWidth;
}

function setSetting(key, value) {
  if (!(key in DEFAULT_SETTINGS)) return;
  settings = { ...settings, [key]: normalizeSettingValue(findSettingOption(key), value) };
  saveSettings();
  applySettings(key);
  renderSettingsContent();
}

function applySettings(changedKey) {
  const root = document.documentElement;
  root.style.setProperty('--vuppo-code-font-size', `${settings.editorFontSize}px`);
  root.style.setProperty('--vuppo-code-tab-size', `${settings.editorTabSize}`);
  root.style.setProperty('--vuppo-minimap-width', `${getMinimapWidth()}px`);
  root.style.setProperty('--vuppo-chat-font-size', `${settings.chatFontSize}px`);
  document.body.classList.toggle('vuppo-nowrap-code', settings.editorWordWrap === false);
  document.body.classList.toggle('vuppo-hide-line-numbers', settings.editorLineNumbers === false);
  document.body.classList.toggle('vuppo-hide-minimap', settings.editorMinimap === false);
  window.VuppoEditor?.applySettings(settings);
  activeMinimapRefresh?.();
  if (currentReport?.gitStatus && (!changedKey || changedKey.startsWith('git'))) renderSourceControlView();
  applySeverityFilter();
}

function applySeverityFilter() {
  const minRank = SEVERITY_RANK[settings.securityMinSeverity] || 1;
  document.querySelectorAll('.workspace-findings').forEach((list) => {
    const rows = [...list.querySelectorAll('.workspace-finding')];
    let visible = 0;
    rows.forEach((row) => {
      const severity = [...(row.querySelector('.finding-severity')?.classList || [])].find((name) => name !== 'finding-severity') || 'low';
      const show = (SEVERITY_RANK[severity] || 0) >= minRank;
      row.classList.toggle('hidden', !show);
      if (show) visible += 1;
    });
    const notice = list.querySelector('.severity-filter-empty');
    if (rows.length && !visible) {
      if (!notice) {
        const empty = document.createElement('div');
        empty.className = 'workspace-empty-state severity-filter-empty';
        empty.textContent = 'Nenhum risco corresponde ao filtro de severidade definido nas configurações.';
        list.appendChild(empty);
      }
    } else notice?.remove();
  });
}

function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character])); }

let settingsActiveCategory = 'editor';
let settingsOverlayElement = null;

function ensureSettingsOverlay() {
  if (settingsOverlayElement) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="vuppo-settings-overlay hidden" id="vuppo-settings" role="dialog" aria-modal="true" aria-label="Configurações"><header class="vuppo-settings-topbar"><span class="vuppo-settings-logo"><img src="vuppo-icon.png" alt="Vuppo" /></span><strong>Configurações</strong><div class="vuppo-settings-search"><i class="codicon codicon-search" aria-hidden="true"></i><input id="vuppo-settings-search" type="text" placeholder="Procurar configurações" autocomplete="off" spellcheck="false" aria-label="Procurar configurações" /></div><button type="button" class="vuppo-settings-close" id="vuppo-settings-close" title="Fechar (Esc)" aria-label="Fechar configurações">×</button></header><div class="vuppo-settings-layout"><nav class="vuppo-settings-categories" id="vuppo-settings-categories" aria-label="Categorias"></nav><div class="vuppo-settings-content" id="vuppo-settings-content"></div></div><footer class="vuppo-settings-footer"><span>Vuppo <b>${VUPPO_VERSION}</b></span><span>Editor de código com auditoria de segurança integrada</span></footer></div>`);
  settingsOverlayElement = $('#vuppo-settings');
  const categoriesNav = $('#vuppo-settings-categories');
  const content = $('#vuppo-settings-content');
  const searchInput = $('#vuppo-settings-search');
  $('#vuppo-settings-close').addEventListener('click', closeVuppoSettings);
  categoriesNav.addEventListener('click', (event) => {
    const item = event.target.closest('[data-settings-category]');
    if (!item) return;
    settingsActiveCategory = item.dataset.settingsCategory;
    if (searchInput) searchInput.value = '';
    renderSettingsContent();
  });
  content.addEventListener('change', (event) => {
    const input = event.target.closest('[data-setting-input]');
    if (!input) return;
    setSetting(input.dataset.settingInput, input.type === 'checkbox' ? input.checked : input.value);
  });
  content.addEventListener('click', (event) => {
    const resetButton = event.target.closest('[data-reset-setting]');
    if (resetButton) {
      setSetting(resetButton.dataset.resetSetting, DEFAULT_SETTINGS[resetButton.dataset.resetSetting]);
      return;
    }
    const accountAction = event.target.closest('[data-account-action]');
    if (!accountAction) return;
    const action = accountAction.dataset.accountAction;
    if (action === 'upgrade') {
      closeVuppoSettings();
      openPlansModal();
    } else if (action === 'logout') {
      accountAction.disabled = true;
      window.vuppo.logout()
        .then(() => window.location.reload())
        .catch(() => { accountAction.disabled = false; });
    } else {
      handleSettingsGithubAction(action, accountAction);
    }
  });
  searchInput.addEventListener('input', () => renderSettingsContent());
}

function renderSettingsRow(option) {
  const value = settings[option.key];
  const isModified = value !== DEFAULT_SETTINGS[option.key];
  const disabled = option.isDisabled ? Boolean(option.isDisabled(settings)) : false;
  let control = '';
  if (option.type === 'checkbox') control = `<label class="settings-checkbox"><input type="checkbox" data-setting-input="${option.key}" ${value ? 'checked' : ''} aria-label="${escapeHtml(option.label)}" /><span></span></label>`;
  else if (option.type === 'number') control = `<input type="number" data-setting-input="${option.key}" value="${value}" min="${option.min}" max="${option.max}" step="${option.step || 1}" aria-label="${escapeHtml(option.label)}" />`;
  else if (option.type === 'select') control = `<select data-setting-input="${option.key}" aria-label="${escapeHtml(option.label)}">${option.choices.map(([stored, label]) => `<option value="${stored}" ${stored === value ? 'selected' : ''}>${label}</option>`).join('')}</select>`;
  return `<div class="settings-row ${isModified ? 'is-modified' : ''} ${disabled ? 'is-disabled' : ''}" data-setting-row="${option.key}"><div class="settings-row-text"><strong>${escapeHtml(option.label)}</strong><span>${escapeHtml(option.description || '')}</span></div><div class="settings-row-control">${control}<button type="button" class="settings-reset" data-reset-setting="${option.key}" title="Redefinir configuração" aria-label="Redefinir ${escapeHtml(option.label)}">⟲</button></div></div>`;
}

function renderSettingsContent() {
  const categoriesNav = $('#vuppo-settings-categories');
  const content = $('#vuppo-settings-content');
  if (!categoriesNav || !content) return;
  const query = ($('#vuppo-settings-search')?.value || '').trim().toLowerCase();
  const categories = SETTINGS_SCHEMA.map((category) => ({
    ...category,
    options: category.options.filter((option) => !query || `${option.label} ${option.description || ''}`.toLowerCase().includes(query)),
  }));
  categoriesNav.innerHTML = categories.map((category) => `<button type="button" class="settings-category-item ${!query && category.id === settingsActiveCategory ? 'active' : ''}" data-settings-category="${category.id}">${category.icon}<span>${category.label}</span>${query ? `<span class="settings-category-count">${category.options.length}</span>` : ''}</button>`).join('');
  if (query) {
    const matches = categories.filter((category) => category.options.length);
    content.innerHTML = matches.length ? matches.map((category) => renderSettingsSection(category, true)).join('') : `<p class="settings-empty">Nenhuma configuração encontrada para "${escapeHtml(query)}".</p>`;
    return;
  }
  const activeCategory = SETTINGS_SCHEMA.find((category) => category.id === settingsActiveCategory) || SETTINGS_SCHEMA[0];
  content.innerHTML = activeCategory.id === 'about'
    ? `<section class="settings-section"><p class="settings-breadcrumb">Configurações › Sobre</p><h3 class="settings-section-title">Sobre</h3><div class="settings-about"><div class="settings-about-mark"><img src="vuppo-icon.png" alt="Vuppo" /></div><div><strong>Vuppo</strong><span>Versão ${VUPPO_VERSION}</span></div></div><div class="settings-about-copy"><p>A VUPPO nasceu com a visão de tornar o desenvolvimento de software mais produtivo, organizado e eficiente.</p><p>Desenvolvida com foco na experiência do desenvolvedor, a VUPPO reúne recursos que ajudam a transformar ideias em soluções reais, oferecendo um ambiente moderno, intuitivo e preparado para os desafios do desenvolvimento atual.</p><p>À medida que evoluímos, continuamos dedicados a aprimorar a experiência dos usuários e a oferecer recursos que impulsionem a criatividade, a produtividade e a excelência no desenvolvimento.</p></div></section>`
    : activeCategory.id === 'account'
      ? renderAccountSection()
      : renderSettingsSection(activeCategory, false);
  if (activeCategory.id === 'account') { fillSettingsAccount(); fillSettingsGithub(); fillSettingsCredits(); }
}

function renderSettingsSection(category, fromSearch) {
  const rows = category.options.map((option) => renderSettingsRow(option)).join('');
  return `<section class="settings-section" data-settings-section="${category.id}"><p class="settings-breadcrumb">Configurações › ${category.label}${fromSearch ? ' › Resultados' : ''}</p><h3 class="settings-section-title">${category.label}</h3>${rows}</section>`;
}

function renderAccountSection() {
  return `<section class="settings-section" data-settings-section="account"><p class="settings-breadcrumb">Configurações › Conta</p><h3 class="settings-section-title">Conta</h3><div class="settings-account" id="settings-account-card"><div class="settings-account-head"><div class="settings-account-avatar" id="settings-account-avatar">V</div><div class="settings-account-info"><strong id="settings-account-name">Conta local Vuppo</strong><span id="settings-account-email">Carregando…</span></div><span class="settings-account-plan" id="settings-account-plan">Free Plan</span></div></div><div class="settings-account settings-connection" id="settings-github-card"><div class="settings-connection-head"><span class="settings-connection-icon codicon codicon-github" aria-hidden="true"></span><div class="settings-connection-info"><strong>GitHub</strong><span id="settings-github-status">Verificando conexão…</span></div><span class="settings-connection-pill" id="settings-github-pill">Verificando…</span></div><p class="settings-inline-hint" id="settings-github-hint" hidden></p><div class="settings-connection-actions"><button type="button" class="settings-action settings-action-primary" id="settings-github-connect" data-account-action="github-connect">Conectar GitHub</button><button type="button" class="settings-action" id="settings-github-refresh" data-account-action="github-refresh">Verificar novamente</button><button type="button" class="settings-action" id="settings-github-copy" data-account-action="github-copy" hidden>Copiar código</button><button type="button" class="settings-action settings-action-danger" id="settings-github-disconnect" data-account-action="github-disconnect" hidden>Desconectar</button></div></div><div class="settings-account settings-credits" id="settings-credits-card"><div class="settings-credits-head"><div class="settings-connection-info"><strong>Créditos do plano</strong><span id="settings-credits-plan">Free Plan · 500 créditos a cada ciclo</span></div><span class="settings-account-plan" id="settings-credits-badge">Free Plan</span></div><div class="credits-bar" id="settings-credits-bar" role="progressbar" aria-label="Créditos usados" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="credits-bar-fill" id="settings-credits-fill"></span></div><div class="settings-credits-stats"><span><b id="settings-credits-used">0</b> usados de <b id="settings-credits-limit">500</b></span><span><b id="settings-credits-remaining">500</b> restantes</span><span id="settings-credits-percent">0%</span></div><p class="settings-inline-hint" id="settings-credits-meta">Carregando consumo…</p><div class="settings-credits-history" id="settings-credits-history"></div></div><div class="settings-row"><div class="settings-row-text"><strong>Plano atual</strong><span id="settings-plan-summary">Você está no Free Plan. Faça upgrade para Pro ou Team quando quiser.</span></div><div class="settings-row-control"><button type="button" class="settings-action settings-action-primary" data-account-action="upgrade">Fazer upgrade</button></div></div><div class="settings-row"><div class="settings-row-text"><strong>Provedor de acesso</strong><span id="settings-account-provider">…</span></div></div><div class="settings-row"><div class="settings-row-text"><strong>Sair da conta</strong><span>Encerra a sessão atual e volta para a tela de login.</span></div><div class="settings-row-control"><button type="button" class="settings-action settings-action-danger" data-account-action="logout">Sair</button></div></div></section>`;
}

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
// A renovação do ciclo é uma data de calendário (UTC), por isso não sofre conversão de fuso.
const UTC_DATE_FORMATTER = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });

function formatCredits(value) {
  return (Number(value) || 0).toLocaleString('pt-BR');
}

function formatShortDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : UTC_DATE_FORMATTER.format(date);
}

function formatDateTime(value) {
  if (!value) return '--';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '--' : DATE_TIME_FORMATTER.format(date);
}

let usageCache = null;
let usageRequestId = 0;

async function refreshUsage() {
  const requestId = ++usageRequestId;
  let usage = null;
  try { usage = (await window.vuppo.getUsage?.()) || null; } catch { usage = null; }
  if (requestId !== usageRequestId) return usageCache;
  if (usage) usageCache = usage;
  applyUsageToUI(usageCache);
  return usageCache;
}

function creditsMeta(usage) {
  if (!usage.signedIn) return 'Entre na sua conta Vuppo para acompanhar o consumo de créditos do seu plano.';
  const renewal = formatShortDate(usage.renewsAt);
  if (usage.remaining === 0 && usage.used >= usage.limit) return `Créditos do ciclo esgotados${usage.overage ? ` (${formatCredits(usage.overage)} acima do limite)` : ''}. Renova em ${renewal}.`;
  return `Ciclo de ${usage.cycleLabel} · ${formatCredits(usage.remaining)} créditos restantes · renova em ${renewal}.`;
}

function applyUsageToUI(usage) {
  if (!usage) return;
  const homeLabel = $('#vuppo-home-plan-label');
  if (homeLabel) homeLabel.textContent = usage.planLabel;
  const planBadge = $('#settings-account-plan');
  if (planBadge) planBadge.textContent = usage.planLabel;
  const creditsBadge = $('#settings-credits-badge');
  if (creditsBadge) creditsBadge.textContent = usage.planLabel;
  const creditsPlan = $('#settings-credits-plan');
  if (creditsPlan) creditsPlan.textContent = `${usage.planLabel} · ${formatCredits(usage.limit)} créditos a cada ciclo`;
  const used = $('#settings-credits-used');
  if (used) used.textContent = formatCredits(usage.used);
  const limit = $('#settings-credits-limit');
  if (limit) limit.textContent = formatCredits(usage.limit);
  const remaining = $('#settings-credits-remaining');
  if (remaining) remaining.textContent = formatCredits(usage.remaining);
  const percent = $('#settings-credits-percent');
  if (percent) percent.textContent = `${usage.percent}%`;
  const fill = $('#settings-credits-fill');
  if (fill) fill.style.width = `${usage.percent}%`;
  const bar = $('#settings-credits-bar');
  if (bar) {
    bar.setAttribute('aria-valuenow', String(Math.round(usage.percent)));
    bar.classList.toggle('is-warning', usage.percent >= 70 && usage.percent < 100);
    bar.classList.toggle('is-full', usage.percent >= 100);
  }
  const meta = $('#settings-credits-meta');
  if (meta) {
    meta.classList.toggle('is-error', Boolean(usage.signedIn && usage.remaining === 0 && usage.used > 0));
    meta.textContent = creditsMeta(usage);
  }
  const history = $('#settings-credits-history');
  if (history) {
    history.innerHTML = usage.history.length
      ? `<span class="settings-credits-history-title">Últimas análises</span>${usage.history.slice(0, 5).map((entry) => `<div class="settings-credits-history-item"><span>${escapeHtml(entry.label)}</span><span>${formatCredits(entry.credits)} créditos · ${formatDateTime(entry.at)}</span></div>`).join('')}`
      : '';
  }
  const summary = $('#settings-plan-summary');
  if (summary) {
    const upgrades = (usage.plans || []).filter((plan) => plan.id !== usage.plan);
    summary.textContent = usage.signedIn
      ? `Você está no ${usage.planLabel}, com ${formatCredits(usage.limit)} créditos por ciclo.${upgrades.length ? ` Faça upgrade para ${upgrades.map((plan) => `${plan.name} (${formatCredits(plan.credits)} créditos)`).join(' ou ')}.` : ''}`
      : 'Entre na sua conta Vuppo para acompanhar o consumo de créditos do seu plano.';
  }
  fillPlansModal(usage);
}

function fillSettingsCredits() {
  if (!$('#settings-credits-card')) return;
  if (usageCache) applyUsageToUI(usageCache);
  else refreshUsage();
}

function fillSettingsAccount() {
  if (!$('#settings-account-card')) return;
  Promise.resolve(window.vuppo.getSession?.()).then((account) => {
    if (!$('#settings-account-card')) return;
    const name = $('#settings-account-name');
    const email = $('#settings-account-email');
    const provider = $('#settings-account-provider');
    const avatar = $('#settings-account-avatar');
    if (!account) {
      if (name) name.textContent = 'Conta local Vuppo';
      if (email) email.textContent = 'Nenhuma sessão ativa.';
      if (provider) provider.textContent = 'Sessão local';
      return;
    }
    if (name) name.textContent = account.name || 'Conta Vuppo';
    if (email) email.textContent = account.email || '';
    if (avatar) avatar.textContent = (String(account.name || account.email || '?').trim().charAt(0) || 'V').toUpperCase();
    if (provider) provider.textContent = ({ email: 'E-mail e senha', google: 'Google', github: 'GitHub', apple: 'Apple' })[account.provider] || 'E-mail e senha';
  }).catch(() => {});
  refreshUsage();
}

let githubStatusCache = null;
let githubPollTimer = null;
let githubPollStopAt = 0;

async function fillSettingsGithub() {
  if (!$('#settings-github-card')) return;
  try {
    githubStatusCache = (await window.vuppo.githubStatus?.()) || null;
  } catch (error) {
    githubStatusCache = { connected: false, error: (error && error.message) || 'Não foi possível verificar a conexão com o GitHub.' };
  }
  renderGithubStatus(githubStatusCache);
}

function setGithubHint(message, isError) {
  const hint = $('#settings-github-hint');
  if (!hint) return;
  hint.textContent = message || '';
  hint.hidden = !message;
  hint.classList.toggle('is-error', Boolean(isError));
}

function githubHint(status) {
  if (!status) return '';
  if (status.error) return status.error;
  if (status.oauthConfigured) return 'A conexão abre o navegador e pede um código de autorização do GitHub.';
  if (status.cliAvailable) return 'A conexão usa a GitHub CLI (gh) instalada nesta máquina.';
  return 'Instale a GitHub CLI (gh) ou defina VUPPO_GITHUB_CLIENT_ID para conectar pelo OAuth do GitHub.';
}

function renderGithubStatus(status) {
  const statusText = $('#settings-github-status');
  if (!statusText) return;
  const pill = $('#settings-github-pill');
  const connect = $('#settings-github-connect');
  const disconnect = $('#settings-github-disconnect');
  const copy = $('#settings-github-copy');
  const pending = status && status.pending && status.pending.status === 'pending' ? status.pending : null;
  if (status && status.connected) {
    statusText.textContent = `Conectado como @${status.login}${status.source === 'cli' ? ' · GitHub CLI' : ''}`;
    if (pill) { pill.textContent = 'CONECTADO'; pill.className = 'settings-connection-pill is-connected'; }
  } else if (pending) {
    statusText.textContent = `Aguardando autorização · código ${pending.userCode}`;
    if (pill) { pill.textContent = 'AGUARDANDO'; pill.className = 'settings-connection-pill is-pending'; }
  } else {
    statusText.textContent = 'Nenhuma conta do GitHub conectada.';
    if (pill) { pill.textContent = 'NÃO CONECTADO'; pill.className = 'settings-connection-pill'; }
  }
  if (connect) { connect.hidden = Boolean((status && status.connected) || pending); connect.disabled = false; }
  if (disconnect) disconnect.hidden = !(status && status.connected);
  if (copy) copy.hidden = !pending;
  setGithubHint(pending ? `Informe o código ${pending.userCode} em ${pending.verificationUri} para autorizar a conexão.` : githubHint(status), Boolean(status && status.error));
  if (pending) { if (!githubPollTimer) startGithubPolling(); }
  else stopGithubPolling();
}

function startGithubPolling() {
  stopGithubPolling();
  githubPollStopAt = Date.now() + 15 * 60 * 1000;
  githubPollTimer = setInterval(async () => {
    if (Date.now() > githubPollStopAt) { stopGithubPolling(); return; }
    await fillSettingsGithub();
    if (!githubStatusCache || githubStatusCache.connected || !githubStatusCache.pending || githubStatusCache.pending.status !== 'pending') stopGithubPolling();
  }, 3000);
}

function stopGithubPolling() {
  if (githubPollTimer) clearInterval(githubPollTimer);
  githubPollTimer = null;
}

function copyText(value) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(value); return true; }
  } catch { /* clipboard indisponível */ }
  try {
    const field = document.createElement('textarea');
    field.value = value;
    field.setAttribute('readonly', 'readonly');
    field.style.position = 'fixed';
    field.style.opacity = '0';
    document.body.appendChild(field);
    field.select();
    const copied = document.execCommand('copy');
    field.remove();
    return copied;
  } catch {
    return false;
  }
}

async function handleSettingsGithubAction(action, button) {
  if (action === 'github-copy') {
    const code = githubStatusCache && githubStatusCache.pending ? githubStatusCache.pending.userCode : '';
    if (code && copyText(code)) setGithubHint(`Código ${code} copiado para a área de transferência.`);
    else if (code) setGithubHint(`Copie o código ${code} e informe na página do GitHub.`);
    return;
  }
  if (action === 'github-refresh') {
    button.disabled = true;
    await fillSettingsGithub();
    button.disabled = false;
    return;
  }
  if (action === 'github-disconnect') {
    button.disabled = true;
    stopGithubPolling();
    try {
      await window.vuppo.githubDisconnect();
      await fillSettingsGithub();
      setGithubHint('Conta do GitHub desconectada.');
    } catch (error) {
      setGithubHint((error && error.message) || 'Não foi possível desconectar a conta do GitHub.', true);
    } finally {
      button.disabled = false;
    }
    return;
  }
  button.disabled = true;
  setGithubHint('Iniciando conexão com o GitHub…');
  try {
    const result = await window.vuppo.githubConnect();
    if (result && result.status === 'pending') {
      githubStatusCache = { ...(githubStatusCache || {}), connected: false, pending: { userCode: result.userCode, verificationUri: result.verificationUri, status: 'pending', error: '' } };
      renderGithubStatus(githubStatusCache);
    } else {
      await fillSettingsGithub();
    }
  } catch (error) {
    setGithubHint((error && error.message) || 'Não foi possível conectar ao GitHub.', true);
    button.disabled = false;
  }
}

function openPlansModal() {
  const modal = $('#plans-modal');
  if (!modal) return;
  if (usageCache) fillPlansModal(usageCache);
  else refreshUsage();
  modal.classList.remove('hidden');
}

function fillPlansModal(usage) {
  const list = $('#plans-list');
  if (!list || !usage || !Array.isArray(usage.plans) || !usage.plans.length) return;
  list.innerHTML = usage.plans.map((plan) => {
    const featured = plan.id === 'pro';
    const current = plan.id === usage.plan;
    return `<article class="plan-card ${featured ? 'plan-featured' : ''}" data-plan="${plan.id}">${featured ? '<span class="plan-badge">RECOMENDADO</span>' : ''}<h4>${escapeHtml(plan.name)}</h4><p>${escapeHtml(plan.description)}</p><strong>$${plan.price} <small>/ mês</small></strong><span class="plan-credits">${formatCredits(plan.credits)} créditos por ciclo</span>${current ? '<button class="plan-current" disabled>Plano atual</button>' : `<button class="plan-select" data-plan-select="${plan.id}">Escolher ${escapeHtml(plan.name)}</button>`}</article>`;
  }).join('');
  list.querySelectorAll('[data-plan-select]').forEach((button) => button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await window.vuppo.setPlan(button.dataset.planSelect);
      await refreshUsage();
    } catch (error) {
      button.disabled = false;
      alert((error && error.message) || 'Não foi possível trocar de plano.');
    }
  }));
}

function openVuppoSettings(category) {
  ensureSettingsOverlay();
  if (category) settingsActiveCategory = category;
  const searchInput = $('#vuppo-settings-search');
  if (searchInput) searchInput.value = '';
  renderSettingsContent();
  settingsOverlayElement.classList.remove('hidden');
  searchInput?.focus();
}

function closeVuppoSettings() {
  settingsOverlayElement?.classList.add('hidden');
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && settingsOverlayElement && !settingsOverlayElement.classList.contains('hidden')) closeVuppoSettings();
});

applySettings();

function readRecentProjects() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(RECENT_PROJECTS_KEY) || '[]');
    return Array.isArray(stored) ? stored.filter((item) => typeof item === 'string' && item) : [];
  } catch {
    return [];
  }
}

function rememberProject(projectPath) {
  if (!projectPath) return;
  const recent = readRecentProjects().filter((item) => item.toLowerCase() !== projectPath.toLowerCase());
  recent.unshift(projectPath);
  try { window.localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent.slice(0, 8))); } catch { /* armazenamento indisponível */ }
}

function normalizeTreePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

// Ordenação padrão do Explorer do VS Code: pastas antes dos arquivos e comparação de
// nomes sem diferenciar maiúsculas de minúsculas (equivalente a compareFileNamesDefault).
function compareTreeEntries(first, second) {
  const one = String(first ?? '');
  const other = String(second ?? '');
  if (one === other) return 0;
  if (!one) return -1;
  if (!other) return 1;
  const lowerOne = one.toLowerCase();
  const lowerOther = other.toLowerCase();
  if (lowerOne === lowerOther) return one < other ? -1 : 1;
  return lowerOne < lowerOther ? -1 : 1;
}

function parentTreePath(value) {
  const parts = normalizeTreePath(value).split('/');
  parts.pop();
  return parts.join('/');
}

const WINDOWS_RESERVED_ENTRY_NAMES = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const INVALID_ENTRY_CHARACTERS = /[<>:"|?*\u0000-\u001F]/;

function getWellFormedEntryName(value) {
  return String(value ?? '').replace(/\t/g, '').replace(/[\\/]+$/, '');
}

function isValidEntrySegment(segment) {
  if (!segment || segment.length > 255) return false;
  if (INVALID_ENTRY_CHARACTERS.test(segment)) return false;
  if (/[. ]$/.test(segment)) return false;
  return !WINDOWS_RESERVED_ENTRY_NAMES.test(segment);
}

function trimEntryName(name) {
  return name.length > 255 ? `${name.slice(0, 255)}...` : name;
}

// Regras equivalentes às do VS Code (validateFileName + hasValidBasename do Windows).
function explorerCreateValidation(kind, value, targetFolder, options = {}) {
  const raw = String(value ?? '');
  const root = normalizeTreePath(targetFolder);
  const ignorePath = normalizeTreePath(options.ignorePath).toLowerCase();
  const invalid = (message) => ({ valid: false, severity: 'error', message, path: '', isFolder: false });
  const name = getWellFormedEntryName(raw);
  if (!name || /^\s+$/.test(name)) return invalid('Um nome de arquivo ou pasta deve ser fornecido.');
  if (/^[\\/]/.test(name)) return invalid('Um nome de arquivo ou pasta não pode começar com uma barra.');
  const segments = name.split(/[\\/]/).filter(Boolean);
  if (!segments.length) return invalid('Um nome de arquivo ou pasta deve ser fornecido.');
  const fullPath = root ? `${root}/${segments.join('/')}` : segments.join('/');
  const entryName = segments[segments.length - 1];
  const isFolder = kind === 'folder' || /[\\/]$/.test(raw);
  const files = (currentReport?.files || []).map((file) => normalizeTreePath(file.file).toLowerCase());
  const directories = (currentReport?.directories || []).map((directory) => normalizeTreePath(directory).toLowerCase());
  const fileAncestor = segments
    .slice(0, -1)
    .map((_, index) => (root ? `${root}/${segments.slice(0, index + 1).join('/')}` : segments.slice(0, index + 1).join('/')))
    .find((ancestor) => files.includes(ancestor.toLowerCase()));
  if (fileAncestor) return invalid(`"${fileAncestor.split('/').pop()}" já é um arquivo. Escolha outra pasta.`);
  if (files.includes(fullPath.toLowerCase()) || directories.includes(fullPath.toLowerCase())) {
    if (fullPath.toLowerCase() !== ignorePath) return invalid(`Um arquivo ou pasta "${entryName}" já existe neste local. Escolha outro nome.`);
  }
  const invalidSegment = segments.find((segment) => !isValidEntrySegment(segment));
  if (invalidSegment) return invalid(`O nome "${trimEntryName(invalidSegment)}" não é válido como nome de arquivo ou pasta. Escolha outro nome.`);
  if (segments.some((segment) => /^\s|\s$/.test(segment))) return { valid: true, severity: 'warning', message: 'Espaço em branco no início ou no fim do nome detectado.', path: fullPath, isFolder };
  return { valid: true, severity: null, message: '', path: fullPath, isFolder };
}

function currentExplorerCreateTarget() {
  const folderRow = document.querySelector('.workspace .tree-folder-item.selected');
  if (folderRow) return normalizeTreePath(folderRow.dataset.folder);
  const fileRow = document.querySelector('.workspace .tree-file.selected');
  if (fileRow) return parentTreePath(fileRow.dataset.file);
  return '';
}

function revealExplorerSidebar() {
  const workspace = document.querySelector('.workspace');
  const sidebar = workspace?.querySelector('.workspace-sidebar');
  if (!workspace || !sidebar) return;
  sidebar.classList.remove('is-collapsed');
  workspace.querySelector('.workspace-body')?.classList.remove('sidebar-closed');
  sidebar.dataset.sideView = 'explorer';
  workspace.querySelectorAll('.activity-button').forEach((button) => {
    button.classList.toggle('active', button.getAttribute('title') === 'Explorador de arquivos');
  });
}

function findTreeFolderRow(folderPath) {
  const normalized = normalizeTreePath(folderPath).toLowerCase();
  if (!normalized) return null;
  return [...document.querySelectorAll('.tree-folder-item')]
    .find((item) => normalizeTreePath(item.dataset.folder).toLowerCase() === normalized) || null;
}

function expandTreeFolderRow(folderRow) {
  if (!folderRow) return;
  folderRow.classList.remove('collapsed');
  const chevron = folderRow.querySelector('.tree-chevron');
  if (chevron) chevron.textContent = '⌄';
  const icon = folderRow.querySelector('.tree-folder-icon');
  if (icon) icon.src = 'assets/material-icons/folder-open.svg';
  folderRow.nextElementSibling?.classList.remove('collapsed');
  const ancestor = folderRow.parentElement?.closest('.tree-folder-item');
  if (ancestor) expandTreeFolderRow(ancestor);
}

function cancelInlineCreate() {
  if (!activeInlineCreate) return;
  const session = activeInlineCreate;
  activeInlineCreate = null;
  session.row.remove();
  session.error.remove();
  session.onCancel?.();
}

function revealCreatedEntry(relativePath, isFolder) {
  const normalized = normalizeTreePath(relativePath).toLowerCase();
  if (isFolder) {
    document.querySelectorAll('.tree-folder-item.selected,.tree-file.selected').forEach((item) => item.classList.remove('selected'));
    const row = findTreeFolderRow(relativePath);
    if (row) {
      row.classList.add('selected');
      row.scrollIntoView({ block: 'nearest' });
    }
    return;
  }
  const fileButton = [...document.querySelectorAll('.tree-file')]
    .find((button) => normalizeTreePath(button.dataset.file).toLowerCase() === normalized);
  if (fileButton) selectWorkspaceFile(fileButton.dataset.file);
}

function startExplorerCreate(kind, targetFolder = '', options = {}) {
  const workspace = document.querySelector('.workspace');
  const fileTree = workspace?.querySelector('.file-tree');
  if (!workspace || !fileTree || !currentReport) return;
  cancelInlineCreate();
  revealExplorerSidebar();
  const targetPath = normalizeTreePath(targetFolder);
  let container = fileTree.querySelector('.tree-children.root-children');
  if (targetPath) {
    const folderRow = findTreeFolderRow(targetPath);
    if (!folderRow) return;
    expandTreeFolderRow(folderRow);
    container = folderRow.nextElementSibling;
  }
  if (!container) return;
  const isFolder = kind === 'folder';
  const levelFromAnchor = Number.parseInt(options.anchorRow?.style.getPropertyValue('--tree-level') || '', 10);
  const level = Number.isNaN(levelFromAnchor) ? (targetPath ? targetPath.split('/').length : 0) : levelFromAnchor;
  const row = document.createElement('div');
  row.className = 'tree-create-row';
  row.style.setProperty('--tree-level', String(level));
  row.innerHTML = `<span class="tree-create-icon">${isFolder ? '<img src="assets/material-icons/folder.svg" class="tree-folder-icon" alt="" />' : fileIconMarkup('')}</span><input class="tree-create-input" type="text" autocomplete="off" spellcheck="false" aria-label="Digite o nome. Pressione Enter para confirmar ou Escape para cancelar." />`;
  const error = document.createElement('div');
  error.className = 'tree-create-error hidden';
  error.setAttribute('role', 'alert');
  error.style.setProperty('--tree-level', String(level));
  if (options.anchorRow?.parentElement) {
    // Renomear: o campo ocupa o lugar do item, como no VS Code.
    options.anchorRow.parentElement.insertBefore(row, options.anchorRow.nextSibling);
    row.parentElement.insertBefore(error, row.nextSibling);
    options.anchorRow.classList.add('tree-row-editing');
  } else {
    container.prepend(error);
    container.prepend(row);
  }
  const input = row.querySelector('.tree-create-input');
  const icon = row.querySelector('.tree-create-icon');
  const session = { row, error, input, targetPath, kind, onCancel: () => options.anchorRow?.classList.remove('tree-row-editing') };
  activeInlineCreate = session;
  let selectionState = 'prefix';
  const validate = () => explorerCreateValidation(kind, input.value, targetPath, { ignorePath: options.renameFrom });
  if (options.value) {
    input.value = options.value;
    const dotIndex = input.value.lastIndexOf('.');
    if (isFolder || dotIndex <= 0) input.select();
    else input.setSelectionRange(0, dotIndex);
  }
  const showMessage = (validation) => {
    error.textContent = validation?.message || '';
    error.classList.toggle('hidden', !error.textContent);
    error.classList.toggle('warning', validation?.severity === 'warning');
    input.classList.toggle('invalid', validation?.severity === 'error');
  };
  const updateIcon = () => {
    if (isFolder) return;
    const typed = getWellFormedEntryName(input.value).split(/[\\/]/).pop() || '';
    icon.innerHTML = fileIconMarkup(typed);
  };
  const submit = async () => {
    const validation = validate();
    if (!validation.valid) {
      showMessage(validation);
      input.focus();
      return;
    }
    const renameFrom = normalizeTreePath(options.renameFrom);
    if (renameFrom && renameFrom.toLowerCase() === normalizeTreePath(validation.path).toLowerCase()) {
      cancelInlineCreate();
      return;
    }
    input.disabled = true;
    try {
      if (renameFrom) await window.vuppo.renameEntry({ projectPath: currentReport.projectPath, relativePath: renameFrom, nextRelativePath: validation.path });
      else if (validation.isFolder) await window.vuppo.createFolder({ projectPath: currentReport.projectPath, relativePath: validation.path });
      else await window.vuppo.createFile({ projectPath: currentReport.projectPath, relativePath: validation.path });
      cancelInlineCreate();
      await analyzeProject(currentReport.projectPath);
      revealCreatedEntry(validation.path, validation.isFolder);
    } catch (createError) {
      input.disabled = false;
      showMessage({ severity: 'error', message: createError.message || (normalizeTreePath(options.renameFrom) ? 'Não foi possível renomear.' : 'Não foi possível criar.') });
      input.focus();
    }
  };
  input.addEventListener('input', () => {
    showMessage(validate());
    updateIcon();
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'F2') {
      const dotIndex = input.value.lastIndexOf('.');
      if (!isFolder && dotIndex > 0) {
        event.preventDefault();
        selectionState = selectionState === 'prefix' ? 'all' : selectionState === 'all' ? 'suffix' : 'prefix';
        if (selectionState === 'prefix') input.setSelectionRange(0, dotIndex);
        else if (selectionState === 'all') input.select();
        else input.setSelectionRange(dotIndex + 1, input.value.length);
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelInlineCreate();
    }
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      if (activeInlineCreate !== session || session.input.disabled) return;
      if (document.activeElement === session.input) return;
      if (document.activeElement?.closest?.('.tree-context-menu, .explorer-menu, .workspace-menu-dropdown, .editor-tabs-menu, .recent-menu')) return;
      const validation = validate();
      if (validation.valid) submit();
      else cancelInlineCreate();
    }, 0);
  });
  showMessage(validate());
  row.scrollIntoView({ block: 'nearest' });
  input.focus();
}

function findTreeEntryRow(relativePath) {
  const normalized = normalizeTreePath(relativePath).toLowerCase();
  if (!normalized) return null;
  const folderRow = [...document.querySelectorAll('.tree-folder-item')]
    .find((item) => normalizeTreePath(item.dataset.folder).toLowerCase() === normalized);
  if (folderRow) return folderRow;
  return [...document.querySelectorAll('.tree-file')]
    .find((button) => normalizeTreePath(button.dataset.file).toLowerCase() === normalized) || null;
}

// Renomear no próprio lugar da árvore, como o F2 do VS Code (com o nome sem a extensão selecionado).
function startExplorerRename(relativePath) {
  const normalized = normalizeTreePath(relativePath);
  if (!normalized || !currentReport) return;
  const row = findTreeEntryRow(normalized);
  if (!row) return;
  const isFolder = row.classList.contains('tree-folder-item');
  startExplorerCreate(isFolder ? 'folder' : 'file', parentTreePath(normalized), {
    value: normalized.split('/').pop(),
    renameFrom: normalized,
    anchorRow: row
  });
}

let explorerClipboard = null;

async function copyExplorerEntry(relativePath, isFolder) {
  const normalized = normalizeTreePath(relativePath);
  if (!normalized || !currentReport) return;
  explorerClipboard = { relativePath: normalized, isFolder, projectPath: currentReport.projectPath };
  try { await navigator.clipboard?.writeText(normalized); } catch { /* área de transferência do sistema indisponível */ }
}

async function pasteExplorerEntry(targetFolder) {
  if (!currentReport || !explorerClipboard) return;
  if (explorerClipboard.projectPath !== currentReport.projectPath) {
    alert('Copie um arquivo ou pasta deste projeto para colar aqui.');
    return;
  }
  const folder = normalizeTreePath(targetFolder);
  const name = explorerClipboard.relativePath.split('/').pop();
  const destination = folder ? `${folder}/${name}` : name;
  const copy = (replace) => window.vuppo.copyEntry({
    projectPath: currentReport.projectPath,
    sourcePath: explorerClipboard.relativePath,
    targetFolder: folder,
    replace
  });
  try {
    await copy(false);
  } catch (error) {
    if (!/já existe/i.test(error.message || '')) {
      alert(error.message || 'Não foi possível colar.');
      return;
    }
    if (!confirm(`Um arquivo ou pasta "${name}" já existe neste local. Deseja substituir?`)) return;
    try {
      await copy(true);
    } catch (replaceError) {
      alert(replaceError.message || 'Não foi possível colar.');
      return;
    }
  }
  await analyzeProject(currentReport.projectPath);
  revealCreatedEntry(destination, explorerClipboard.isFolder);
}

function confirmExplorerDelete(name) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'explorer-dialog-overlay';
    overlay.innerHTML = `<div class="explorer-dialog" role="dialog" aria-modal="true" aria-label="Excluir">
      <h3>Excluir "${escapeHtml(name)}"?</h3>
      <p>Você está prestes a excluir <strong>${escapeHtml(name)}</strong> e todo o seu conteúdo.</p>
      <p>O item será enviado para a Lixeira.</p>
      <div class="explorer-dialog-actions"><button type="button" class="explorer-dialog-cancel">Cancelar</button><button type="button" class="explorer-dialog-confirm">Mover para a Lixeira</button></div>
    </div>`;
    const onKeydown = (event) => { if (event.key === 'Escape') { event.preventDefault(); close(false); } };
    const close = (result) => {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    };
    overlay.querySelector('.explorer-dialog-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('.explorer-dialog-confirm').addEventListener('click', () => close(true));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) close(false); });
    document.addEventListener('keydown', onKeydown);
    document.body.appendChild(overlay);
    overlay.querySelector('.explorer-dialog-confirm').focus();
  });
}

async function deleteExplorerEntry(relativePath) {
  const normalized = normalizeTreePath(relativePath);
  if (!normalized || !currentReport) return;
  const name = normalized.split('/').pop();
  if (!(await confirmExplorerDelete(name))) return;
  try {
    await window.vuppo.deleteEntry({ projectPath: currentReport.projectPath, relativePath: normalized, useTrash: true });
    await analyzeProject(currentReport.projectPath);
  } catch (error) {
    alert(error.message || 'Não foi possível excluir.');
  }
}

const chatContextEntries = [];

// "Adicionar ao chat": anexa o arquivo ou a pasta como contexto do chat (como no VS Code).
function renderChatContextChips() {
  const composer = document.querySelector('.workspace [data-feature-panel="chat"] .chat-composer');
  if (!composer) return;
  for (let index = chatContextEntries.length - 1; index >= 0; index -= 1) {
    if (chatContextEntries[index].projectPath !== currentReport?.projectPath) chatContextEntries.splice(index, 1);
  }
  let chips = composer.querySelector('.chat-context-chips');
  if (!chips) {
    chips = document.createElement('div');
    chips.className = 'chat-context-chips';
    composer.prepend(chips);
  }
  chips.innerHTML = chatContextEntries.map((entry, index) => `<span class="chat-context-chip" data-chat-context="${index}"><i class="codicon ${entry.isFolder ? 'codicon-folder' : 'codicon-file'}" aria-hidden="true"></i><span class="chat-context-name">${escapeHtml(entry.path)}</span><button type="button" class="chat-context-remove" title="Remover do contexto" aria-label="Remover do contexto">×</button></span>`).join('');
  chips.classList.toggle('hidden', !chatContextEntries.length);
  chips.querySelectorAll('.chat-context-remove').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const index = Number(button.closest('[data-chat-context]')?.dataset.chatContext);
    if (Number.isInteger(index)) chatContextEntries.splice(index, 1);
    renderChatContextChips();
  }));
}

function addExplorerEntryToChat(relativePath, isFolder) {
  const normalized = normalizeTreePath(relativePath);
  if (!normalized || !currentReport) return;
  if (!chatContextEntries.some((entry) => entry.path === normalized)) {
    chatContextEntries.push({ path: normalized, isFolder, projectPath: currentReport.projectPath });
  }
  const chatPanel = document.querySelector('.workspace [data-feature-panel="chat"]');
  if (chatPanel?.classList.contains('hidden')) document.querySelector('.workspace .top-action-button[title="Chat"]')?.click();
  renderChatContextChips();
  document.querySelector('.workspace [data-feature-panel="chat"] .chat-input textarea')?.focus();
}

function closeWorkspaceFolder() {
  window.VuppoEditor?.disposeAll();
  document.querySelector('.workspace')?.classList.add('hidden');
  document.querySelector('.recent-menu')?.classList.add('hidden');
  $('#dashboard-empty')?.classList.remove('hidden');
  $('#app-shell')?.classList.add('home-mode');
}

function saveActiveEditor() {
  if (window.VuppoEditor?.isOpen()) { window.VuppoEditor.save(); return; }
  document.querySelector('.code-editor')?.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }));
}

async function openFileFromDialog() {
  if (!currentReport) return;
  try {
    const picked = await window.vuppo.openFileDialog();
    if (!picked) return;
    const projectRoot = (currentReport.projectPath || '').replace(/\\/g, '/').replace(/\/+$/, '');
    const absolutePath = picked.filePath.replace(/\\/g, '/');
    const insideProject = Boolean(projectRoot) && absolutePath.toLowerCase().startsWith(`${projectRoot.toLowerCase()}/`);
    const label = insideProject ? absolutePath.slice(projectRoot.length + 1) : picked.filePath;
    const scannedFile = currentReport.files?.find((file) => file.file.replace(/\\/g, '/').toLowerCase() === label.toLowerCase());
    if (scannedFile) { selectWorkspaceFile(scannedFile.file); return; }
    const entry = { file: label, absoluteFile: picked.filePath, content: picked.content, mime: picked.mime, isImage: picked.isImage, external: !insideProject };
    currentReport.files = currentReport.files || [];
    currentReport.files.push(entry);
    document.querySelectorAll('.tree-file').forEach((button) => button.classList.remove('selected'));
    openWorkspaceTab(entry.file);
    renderWorkspaceFile(entry);
  } catch (error) {
    alert(error.message || 'Não foi possível abrir o arquivo.');
  }
}

async function saveActiveEditorAs() {
  const codeEditor = document.querySelector('.code-editor');
  const monacoOpen = Boolean(window.VuppoEditor?.isOpen());
  const activeTab = document.querySelector('.editor-tab.active');
  if ((!codeEditor && !monacoOpen) || !activeTab?.dataset.file) {
    alert('Abra um arquivo para salvar.');
    return;
  }
  const content = monacoOpen ? window.VuppoEditor.getValue() : codeEditor.innerText.replace(/\r\n/g, '\n');
  try {
    const savedPath = await window.vuppo.saveFileAs({ defaultPath: activeTab.dataset.file, content });
    if (!savedPath) return;
    const fileData = currentReport?.files?.find((file) => file.file === activeTab.dataset.file);
    if (fileData) {
      fileData.absoluteFile = savedPath;
      fileData.content = content;
      fileData.external = true;
    }
    if (codeEditor) {
      codeEditor.classList.add('saved');
      setTimeout(() => codeEditor.classList.remove('saved'), 700);
    }
  } catch (error) {
    alert(error.message || 'Não foi possível salvar o arquivo.');
  }
}

async function restoreSession() {
}

$('#auth-form').addEventListener('submit', submitAuth);
$('#switch-auth').addEventListener('click', updateAuthMode);
$('#choose-button').addEventListener('click', chooseProject);
$('#empty-choose').addEventListener('click', chooseProject);
$('#clone-button').addEventListener('click', () => setCloneModal(true));
$('#ssh-button').addEventListener('click', () => alert('A conexão via SSH estará disponível em breve.'));
$('#confirm-clone').addEventListener('click', cloneRepo);
const openHomeFeature = async (feature) => {
  if (!currentReport) {
    if (feature !== 'terminal') { alert('Abra um projeto para usar este recurso.'); return; }
    try {
      const stored = readRecentProjects()[0];
      if (stored) await analyzeProject(stored);
      else await chooseProject();
    } catch { return; }
    if (!currentReport) return;
  }
  if (document.querySelector('.workspace')?.classList.contains('hidden')) return;
  const target = document.querySelector(`.workspace .top-action-button[title="${feature}"]`);
  if (target && !target.classList.contains('active')) target.click();
};
$('#home-preview-button')?.addEventListener('click', () => openHomeFeature('Preview'));
$('#home-terminal-button')?.addEventListener('click', () => openHomeFeature('Terminal'));
$('#home-chat-button')?.addEventListener('click', () => openHomeFeature('Chat'));
const homeMenus = document.querySelector('.home-menus');
if (homeMenus) {
  homeMenus.querySelectorAll('.workspace-menu-button').forEach((button) => {
    button.addEventListener('click', () => {
      const menu = button.closest('.workspace-menu');
      const isOpen = menu.classList.toggle('is-open');
      homeMenus.querySelectorAll('.workspace-menu').forEach((item) => { if (item !== menu) item.classList.remove('is-open'); });
      homeMenus.querySelectorAll('.workspace-menu-button').forEach((item) => item.setAttribute('aria-expanded', item === button && isOpen ? 'true' : 'false'));
    });
  });
  document.addEventListener('click', (event) => {
    if (!homeMenus.contains(event.target)) homeMenus.querySelectorAll('.workspace-menu').forEach((item) => item.classList.remove('is-open'));
  });
  homeMenus.querySelectorAll('[data-home-view]').forEach((button) => {
    button.addEventListener('click', () => {
      button.closest('.workspace-menu').classList.remove('is-open');
      const view = button.dataset.homeView;
      if (!currentReport) { alert('Abra um projeto para usar este recurso.'); return; }
      if (document.querySelector('.workspace')?.classList.contains('hidden')) return;
      const target = document.querySelector(`.workspace [data-workspace-view="${view}"]`);
      if (target) target.click();
    });
  });
  homeMenus.querySelectorAll('[data-home-file-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.homeFileAction;
      button.closest('.workspace-menu').classList.remove('is-open');
      const hasProject = Boolean(currentReport) && !document.querySelector('.workspace')?.classList.contains('hidden');
      switch (action) {
        case 'new-file':
          if (!hasProject) { alert('Abra um projeto para criar arquivos.'); return; }
          document.querySelector('.workspace [data-explorer-action="new-file"]')?.click();
          break;
        case 'new-window': await window.vuppo.openNewWindow(); break;
        case 'open-file':
          if (!hasProject) { alert('Abra um projeto para abrir arquivos.'); return; }
          await openFileFromDialog();
          break;
        case 'open-folder':
        case 'open-project': await chooseProject(); break;
        case 'open-recent':
          if (!hasProject) { alert('Abra um projeto para ver os recentes.'); return; }
          document.querySelector('.workspace [data-file-action="open-recent"]')?.click();
          break;
        case 'save':
        case 'save-all':
          if (!hasProject) { alert('Abra um projeto para salvar.'); return; }
          saveActiveEditor();
          break;
        case 'save-as':
          if (!hasProject) { alert('Abra um projeto para salvar.'); return; }
          await saveActiveEditorAs();
          break;
        case 'close-editor':
          if (hasProject) closeActiveEditor();
          break;
        case 'close-folder':
          if (hasProject) closeWorkspaceFolder();
          break;
        case 'exit': window.vuppo.closeWindow(); break;
        default: break;
      }
    });
  });
}
const homeProfileButton = $('#home-profile-button');
const homeProfileMenu = $('#home-profile-menu');
if (homeProfileButton && homeProfileMenu) {
  homeProfileButton.addEventListener('click', () => homeProfileMenu.classList.toggle('hidden'));
  homeProfileMenu.querySelector('.profile-close').addEventListener('click', () => homeProfileMenu.classList.add('hidden'));
  homeProfileMenu.querySelector('[data-home-profile-action="settings"]').addEventListener('click', () => {
    homeProfileMenu.classList.add('hidden');
    openVuppoSettings();
  });
  document.addEventListener('click', (event) => {
    if (!homeProfileMenu.contains(event.target) && event.target !== homeProfileButton && !homeProfileButton.contains(event.target)) homeProfileMenu.classList.add('hidden');
  });
}
const homeMinimize = $('#home-minimize');
const homeMaximize = $('#home-maximize');
const homeClose = $('#home-close');
const setHomeWindowState = (isMaximized) => {
  const icon = homeMaximize?.querySelector('.window-icon');
  if (icon) icon.className = `window-icon ${isMaximized ? 'restore-icon' : 'maximize-icon'}`;
  if (homeMaximize) {
    homeMaximize.title = isMaximized ? 'Restaurar' : 'Maximizar';
    homeMaximize.setAttribute('aria-label', isMaximized ? 'Restaurar' : 'Maximizar');
  }
};
if (homeMinimize) homeMinimize.addEventListener('click', () => window.vuppo.minimizeWindow());
if (homeClose) homeClose.addEventListener('click', () => window.vuppo.closeWindow());
if (homeMaximize) {
  homeMaximize.addEventListener('click', () => {
    window.vuppo.toggleMaximizeWindow().then((isMaximized) => setHomeWindowState(isMaximized));
  });
  window.vuppo.isWindowMaximized().then((isMaximized) => setHomeWindowState(isMaximized));
}
$('#close-clone').addEventListener('click', () => setCloneModal(false));
$('#cancel-clone').addEventListener('click', () => setCloneModal(false));
$('#repo-url').addEventListener('keydown', (event) => { if (event.key === 'Enter') cloneRepo(); });
$('#settings-button')?.addEventListener('click', () => openVuppoSettings());
const homePlan = $('.vuppo-home-plan');
if (homePlan && !$('#upgrade-button')) homePlan.innerHTML = '<span id="vuppo-home-plan-label">Free Plan</span> <span>·</span> <button type="button" id="upgrade-button">Upgrade</button>';
let plansModal = $('#plans-modal');
if (!plansModal) {
  $('.dashboard').insertAdjacentHTML('beforeend', '<div class="plans-modal hidden" id="plans-modal" role="dialog" aria-modal="true" aria-labelledby="plans-title"><div class="plans-dialog"><div class="clone-dialog-heading"><div><p class="dashboard-kicker">VUPPO PLANS</p><h3 id="plans-title">Choose your plan</h3></div><button class="modal-close" id="close-plans" aria-label="Fechar">&#10005;</button></div><div class="plans-list" id="plans-list"></div><p class="plans-note">A cobrança será habilitada em breve; a troca de plano já ajusta os créditos do ciclo nesta versão.</p></div></div>');
  plansModal = $('#plans-modal');
}
const upgradeButton = $('#upgrade-button');
const closePlansButton = $('#close-plans');
if (upgradeButton && plansModal) upgradeButton.addEventListener('click', () => openPlansModal());
if (closePlansButton && plansModal) closePlansButton.addEventListener('click', () => plansModal.classList.add('hidden'));
refreshUsage();
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

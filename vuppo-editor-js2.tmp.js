const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
require(path.join(__dirname, 'main.js'));

const outFile = path.join(os.tmpdir(), 'vuppo-editor-js2-out.txt');
const projectDir = path.join(os.tmpdir(), 'vuppo-editor-js2');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('TIMEOUT'); app.exit(3); }, 240000);
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'app.js'), 'const apiKey = "x";\nJSON.\n', 'utf8');
  const win = BrowserWindow.getAllWindows()[0];
  win.hide();
  try { win.webContents.setBackgroundThrottling(false); } catch { /* opcional */ }
  if (win.webContents.isLoading()) await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  const logs = [];
  win.webContents.on('console-message', (...args) => {
    const message = typeof args[2] === 'string' ? args[2] : String(args[1]);
    if (!message.includes('Electron Security Warning')) logs.push(message);
  });
  await win.webContents.executeJavaScript(`window.__vuppoTest = ${JSON.stringify({ projectPath: projectDir })};`);
  let result = [];
  try {
    result = await win.webContents.executeJavaScript(`(async () => {
      const out = [];
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      document.querySelector('#auth-shell')?.classList.add('hidden');
      document.querySelector('#app-shell')?.classList.remove('hidden');
      await window.analyzeProject(window.__vuppoTest.projectPath);
      await wait(9000);
      const monaco = window.monaco;
      const ts = monaco.languages.typescript;
      out.push('API: getJavaScriptWorker=' + typeof ts.getJavaScriptWorker + ' setModeConfiguration=' + typeof ts.javascriptDefaults.setModeConfiguration + ' getModeConfiguration=' + typeof ts.javascriptDefaults.getModeConfiguration);
      try {
        const worker = await Promise.race([ts.getJavaScriptWorker(), new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 20000))]);
        out.push('worker tipo=' + typeof worker);
        const uri = monaco.editor.getEditors()[0].getModel().uri;
        const client = typeof worker === 'function' ? await worker(uri) : worker;
        out.push('client tipo=' + typeof client + ' getCompletionsAtPosition=' + typeof client?.getCompletionsAtPosition);
        if (typeof client?.getCompletionsAtPosition === 'function') {
          const completions = await client.getCompletionsAtPosition(uri.toString(), 20, {});
          out.push('completions via worker=' + (completions?.entries?.length ?? 'nenhum') + ' ' + JSON.stringify((completions?.entries || []).slice(0, 5).map((e) => e.name)));
        }
      } catch (error) { out.push('worker erro: ' + error.message); }
      document.body.insertAdjacentHTML('beforeend', '<div id="probe" style="position:fixed;top:0;left:0;width:600px;height:220px;z-index:9999"></div>');
      const probeEditor = monaco.editor.create(document.getElementById('probe'), { value: 'JSON.\\n', language: 'javascript', theme: 'vs-dark' });
      await wait(5000);
      probeEditor.setPosition({ lineNumber: 1, column: 6 });
      probeEditor.focus();
      probeEditor.trigger('vuppo-test', 'editor.action.triggerSuggest', {});
      await wait(5000);
      const rows = [...document.querySelectorAll('#probe .suggest-widget .monaco-list-row')].map((row) => row.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean);
      out.push('suggest JSON. (editor direto) total=' + rows.length + ' ' + JSON.stringify(rows.slice(0, 5)));
      const ours = monaco.editor.getEditors().find((e) => e.getId && e.getId() !== probeEditor.getId());
      return out;
    })()`);
  } catch (error) {
    result = [`executeJavaScript ERRO: ${error.message}`];
  }
  console.log('--- RESULTADO ---');
  for (const line of result) console.log(line);
  console.log('--- CONSOLE ---');
  for (const line of logs.slice(0, 12)) console.log(line);
  fs.writeFileSync(outFile, [...result, '--- CONSOLE ---', ...logs].join('\n'), 'utf8');
  app.exit(0);
});

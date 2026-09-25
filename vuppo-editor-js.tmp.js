const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
require(path.join(__dirname, 'main.js'));

const outFile = path.join(os.tmpdir(), 'vuppo-editor-js-out.txt');
const projectDir = path.join(os.tmpdir(), 'vuppo-editor-js');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('TIMEOUT'); app.exit(3); }, 240000);
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'app.js'), 'const apiKey = "x";\nconst numeros = [1, 2, 3];\nconsole.\ndocument.\nnumeros.\n', 'utf8');
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
      const instance = window.monaco.editor.getEditors()[0];
      const rowsOf = () => [...document.querySelectorAll('.workspace-editor .suggest-widget .monaco-list-row')].map((row) => row.textContent.replace(/\\s+/g, ' ').trim()).filter(Boolean);
      const probe = async (line) => {
        instance.setPosition({ lineNumber: line, column: 999 });
        instance.focus();
        instance.trigger('vuppo-test', 'editor.action.triggerSuggest', {});
        await wait(4000);
        const rows = rowsOf();
        instance.trigger('vuppo-test', 'hideSuggestWidget', {});
        await wait(300);
        return { linha: line, total: rows.length, amostra: rows.slice(0, 4) };
      };
      out.push('console. = ' + JSON.stringify(await probe(3)));
      out.push('document. = ' + JSON.stringify(await probe(4)));
      out.push('numeros. = ' + JSON.stringify(await probe(5)));
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

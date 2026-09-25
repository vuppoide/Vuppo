const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
require(path.join(__dirname, 'main.js'));

const outFile = path.join(os.tmpdir(), 'vuppo-monaco-test2-out.txt');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('TIMEOUT'); app.exit(3); }, 240000);
  const win = BrowserWindow.getAllWindows()[0];
  win.hide();
  if (win.webContents.isLoading()) await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  const logs = [];
  win.webContents.on('console-message', (...args) => {
    const message = typeof args[2] === 'string' ? args[2] : JSON.stringify(args[1]);
    logs.push(String(message));
  });
  let result = [];
  try {
    result = await win.webContents.executeJavaScript(`(async () => {
      const out = [];
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const load = (src) => new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('erro ' + src)); document.head.appendChild(s); });
      await load('node_modules/monaco-editor/min/vs/loader.js');
      window.require.config({ paths: { vs: 'node_modules/monaco-editor/min/vs' } });
      const monaco = await new Promise((resolve, reject) => window.require(['vs/editor/editor.main'], resolve, reject));
      out.push('monaco ok');
      const make = (id, options) => { document.body.insertAdjacentHTML('beforeend', '<div id="' + id + '" style="width:640px;height:220px"></div>'); return monaco.editor.create(document.getElementById(id), Object.assign({ theme: 'vs-dark', automaticLayout: false }, options)); };

      const jsEditor = make('t1', { value: 'const total = 1; // comentario\\nfunction somar(a, b) { return a + b; }\\nclass Pessoa {}\\n', language: 'javascript' });
      await wait(1200);
      const jsTokens = monaco.editor.tokenize('const x = 123; // nota', 'javascript');
      out.push('tokens JS=' + JSON.stringify(jsTokens.map((line) => line.map((t) => t.type))));
      const colorClasses = new Set([...document.querySelectorAll('#t1 .view-lines span[class*=mtk]')].map((node) => node.className.trim()));
      out.push('classes de cor no DOM=' + colorClasses.size + ' -> ' + JSON.stringify([...colorClasses].slice(0, 8)));

      const pyTokens = monaco.editor.tokenize('def soma(a, b):\\n    return a + b  # nota\\n', 'python');
      out.push('tokens PY=' + JSON.stringify(pyTokens.map((line) => line.map((t) => t.type))));

      const suggest = async (editor, id) => {
        editor.focus();
        editor.trigger('vuppo-test', 'editor.action.triggerSuggest', {});
        await wait(2500);
        const rowText = [...document.querySelectorAll('#' + id + ' .suggest-widget .monaco-list-row')].map((row) => row.textContent.replace(/\\s+/g, ' ').trim());
        const visible = document.querySelector('#' + id + ' .suggest-widget');
        return { total: rowText.length, visivel: visible ? !visible.classList.contains('hidden') : false, amostra: rowText.filter((t) => t.length).slice(0, 6) };
      };

      const jsSuggestEditor = make('t2', { value: 'JSON.\\n', language: 'javascript' });
      await wait(1500);
      jsSuggestEditor.setPosition({ lineNumber: 1, column: 6 });
      out.push('suggest JS: ' + JSON.stringify(await suggest(jsSuggestEditor, 't2')));

      const pySuggestEditor = make('t3', { value: 'valor_total = 10\\nvalo\\n', language: 'python' });
      await wait(1500);
      pySuggestEditor.setPosition({ lineNumber: 2, column: 5 });
      out.push('suggest PY (word based): ' + JSON.stringify(await suggest(pySuggestEditor, 't3')));

      const plainSuggestEditor = make('t4', { value: 'linha_especial = 1\\nlin\\n', language: 'plaintext' });
      await wait(1200);
      plainSuggestEditor.setPosition({ lineNumber: 2, column: 4 });
      out.push('suggest plaintext: ' + JSON.stringify(await suggest(plainSuggestEditor, 't4')));

      out.push('getLanguages exemplos=' + JSON.stringify(monaco.languages.getLanguages().slice(0, 5).map((l) => l.id)));
      const ts = monaco.languages.typescript;
      out.push('typescript defaults=' + JSON.stringify({ jsDefaults: typeof ts.javascriptDefaults?.setCompilerOptions, worker: typeof ts.getJavaScriptWorker }));
      return out;
    })()`);
  } catch (error) {
    result = [`executeJavaScript ERRO: ${error.message}`];
  }
  console.log('--- RESULTADO ---');
  for (const line of result) console.log(line);
  console.log('--- CONSOLE ---');
  for (const line of logs.slice(0, 20)) console.log(line);
  fs.writeFileSync(outFile, [...result, '--- CONSOLE ---', ...logs].join('\n'), 'utf8');
  app.exit(0);
});

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
require(path.join(__dirname, 'main.js'));

const outFile = path.join(os.tmpdir(), 'vuppo-monaco-test-out.txt');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('TIMEOUT'); app.exit(3); }, 180000);
  const win = BrowserWindow.getAllWindows()[0];
  win.hide();
  if (win.webContents.isLoading()) await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  const logs = [];
  win.webContents.on('console-message', (_event, level, message) => logs.push(`${level}: ${message}`));
  let result = [];
  try {
    result = await win.webContents.executeJavaScript(`(async () => {
      const out = [];
      const load = (src) => new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('erro ao carregar ' + src)); document.head.appendChild(s); });
      try { await load('node_modules/monaco-editor/min/vs/loader.js'); out.push('loader ok (require=' + typeof window.require + ')'); }
      catch (e) { out.push('loader FALHOU ' + e.message); return out; }
      window.require.config({ paths: { vs: 'node_modules/monaco-editor/min/vs' } });
      const monaco = await new Promise((resolve, reject) => window.require(['vs/editor/editor.main'], resolve, (err) => reject(new Error(String(err)))));
      out.push('monaco ok, languages=' + monaco.languages.getLanguages().length);
      out.push('css links: ' + JSON.stringify([...document.querySelectorAll('link[rel=stylesheet]')].map((l) => l.href).filter((h) => h.includes('editor.main.css'))));
      const div = document.createElement('div');
      div.style.cssText = 'width:700px;height:320px';
      document.body.appendChild(div);
      const editor = monaco.editor.create(div, { value: 'const x = 1;\\nfunction hello(name) { return name; }\\n', language: 'javascript', theme: 'vs-dark' });
      out.push('editor criado, lang=' + editor.getModel().getLanguageId());
      const tokens = monaco.editor.tokenize('const x = 1; // comentario\\nlet s = "texto";', 'javascript');
      out.push('tokens=' + JSON.stringify(tokens.map((line) => line.map((t) => t.type))));
      const words = [...new Set(monaco.languages.getLanguages().map((l) => l.id))].length;
      out.push('ids unicos=' + words);
      try {
        const worker = await Promise.race([monaco.languages.typescript.getJavaScriptWorker(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout worker JS')), 20000))]);
        out.push('worker JS ok (' + typeof worker + ')');
        const modelUri = editor.getModel().uri.toString();
        const client = await worker;
        const completions = await Promise.race([client.getCompletionsAtPosition(modelUri, 50, {}), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout completions')), 20000))]);
        out.push('completions JS entries=' + (completions && completions.entries ? completions.entries.length : 'nenhum'));
      } catch (e) { out.push('worker JS FALHOU: ' + (e && e.message)); }
      try {
        await new Promise((resolve, reject) => {
          const w = new Worker('node_modules/monaco-editor/min/vs/assets/editor.worker-lj3bdIIn.js');
          const timer = setTimeout(() => { w.terminate(); resolve(true); }, 4000);
          w.onerror = (event) => { clearTimeout(timer); w.terminate(); reject(new Error(event.message || 'worker error')); };
        });
        out.push('worker file:// ok');
      } catch (e) { out.push('worker file:// FALHOU: ' + (e && e.message)); }
      editor.dispose();
      return out;
    })()`);
  } catch (error) {
    result = [`executeJavaScript ERRO: ${error.message}`];
  }
  console.log('--- RESULTADO ---');
  for (const line of result) console.log(line);
  console.log('--- CONSOLE ---');
  for (const line of logs.slice(0, 30)) console.log(line);
  fs.writeFileSync(outFile, [...result, '--- CONSOLE ---', ...logs].join('\n'), 'utf8');
  app.exit(0);
});

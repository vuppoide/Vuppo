const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
require(path.join(__dirname, 'main.js'));

const outFile = path.join(os.tmpdir(), 'vuppo-monaco-test3-out.txt');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('TIMEOUT'); app.exit(3); }, 180000);
  const win = BrowserWindow.getAllWindows()[0];
  win.hide();
  try { win.webContents.setBackgroundThrottling(false); } catch { /* opcional */ }
  if (win.webContents.isLoading()) await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  let result = [];
  try {
    result = await win.webContents.executeJavaScript(`(async () => {
      const out = [];
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const load = (src) => new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.onload = () => resolve(); s.onerror = () => reject(new Error('erro ' + src)); document.head.appendChild(s); });
      await load('node_modules/monaco-editor/min/vs/loader.js');
      window.require.config({ paths: { vs: 'node_modules/monaco-editor/min/vs' } });
      const monaco = await new Promise((resolve, reject) => window.require(['vs/editor/editor.main'], resolve, reject));
      document.body.insertAdjacentHTML('beforeend', '<div id="t" style="position:fixed;top:0;left:0;width:700px;height:300px;z-index:99999"></div>');
      const editor = monaco.editor.create(document.getElementById('t'), { value: 'const total = 123; // comentario\\nfunction somar(a, b) { return a + b; }\\n', language: 'javascript', theme: 'vs-dark' });
      await wait(2500);
      const count = () => new Set([...document.querySelectorAll('#t .view-lines span[class*=mtk]')].map((n) => n.className.trim())).size;
      out.push('cores antes do edit=' + count());
      editor.trigger('vuppo', 'type', { text: ' ' });
      await wait(800);
      out.push('cores depois do edit=' + count());
      out.push('html amostra=' + JSON.stringify(document.querySelector('#t .view-lines').innerHTML.slice(0, 400)));
      out.push('valor apos edit=' + JSON.stringify(editor.getValue().slice(-12)));
      return out;
    })()`);
  } catch (error) {
    result = [`executeJavaScript ERRO: ${error.message}`];
  }
  console.log('--- RESULTADO ---');
  for (const line of result) console.log(line);
  fs.writeFileSync(outFile, result.join('\n'), 'utf8');
  app.exit(0);
});

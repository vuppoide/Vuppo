const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
require(path.join(__dirname, 'main.js'));

const outFile = path.join(os.tmpdir(), 'vuppo-editor-e2e-out.txt');
const projectDir = path.join(os.tmpdir(), 'vuppo-editor-e2e');
const files = {
  'app.js': 'const apiKey = "chave-super-secreta-123456";\nfunction somar(a, b) {\n  return a + b;\n}\nconst resultado = somar(1, 2);\nconsole.log(resultado);\n',
  'script.py': 'valor_total = 10\n\ndef somar(a, b):\n    return a + b\n\nprint(somar(valor_total, 5))\n',
  'index.html': '<!doctype html>\n<html lang="pt-BR">\n<body>\n  <div class="card">Ola</div>\n</body>\n</html>\n',
  'style.css': '.card {\n  display: flex;\n  color: #fff;\n}\n',
  'consulta.sql': 'SELECT id, nome FROM usuarios WHERE ativo = true;\n',
};

app.whenReady().then(async () => {
  setTimeout(() => { console.log('TIMEOUT'); app.exit(3); }, 240000);
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(projectDir, { recursive: true });
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(projectDir, name), content, 'utf8');
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
    const page = fs.readFileSync(path.join(__dirname, 'vuppo-editor-e2e-page.tmp.js'), 'utf8');
    result = await win.webContents.executeJavaScript(page);
  } catch (error) {
    result = [`executeJavaScript ERRO: ${error.message}`];
  }
  const readProjectFile = (name) => (fs.existsSync(path.join(projectDir, name)) ? fs.readFileSync(path.join(projectDir, name), 'utf8') : '');
  const disk = [
    `script.py contém marcador do teste: ${readProjectFile('script.py').includes('marcado pelo teste e2e')}`,
    `app.js intacto: ${readProjectFile('app.js').includes('chave-super-secreta')}`,
  ];
  console.log('--- RESULTADO ---');
  for (const line of result) console.log(line);
  console.log('--- DISCO ---');
  for (const line of disk) console.log(line);
  console.log('--- CONSOLE ---');
  for (const line of logs.slice(0, 15)) console.log(line);
  fs.writeFileSync(outFile, [...result, '--- DISCO ---', ...disk, '--- CONSOLE ---', ...logs].join('\n'), 'utf8');
  app.exit(0);
});

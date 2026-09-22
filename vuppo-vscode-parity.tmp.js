const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
require(path.join(__dirname, 'main.js'));

const projectDir = path.join(os.tmpdir(), 'vuppo-inline-test');
const absoluteFile = path.join(projectDir, 'app.js');
const outFile = path.join(os.tmpdir(), 'vuppo-vscode-out.txt');
const lines = [];

app.whenReady().then(async () => {
  setTimeout(() => { console.log('TIMEOUT'); app.exit(3); }, 180000);
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(projectDir, 'docs'), { recursive: true });
  fs.writeFileSync(absoluteFile, 'const apiKey = "x";\n', 'utf8');
  const win = BrowserWindow.getAllWindows()[0];
  win.hide();
  if (win.webContents.isLoading()) await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  const consoleErrors = [];
  win.webContents.on('console-message', (_event, _level, message) => consoleErrors.push(message));
  await win.webContents.executeJavaScript(`window.__vuppoTest = ${JSON.stringify({ projectPath: projectDir, absoluteFile })};`);
  const pageTest = fs.readFileSync(path.join(os.tmpdir(), 'vuppo-vscode-page-test.js'), 'utf8');
  let result;
  try {
    result = await win.webContents.executeJavaScript(pageTest);
  } catch (error) {
    result = [`executeJavaScript ERRO: ${error.message}`];
  }
  lines.push('--- RESULTADO ---');
  for (const line of result) lines.push(line);
  lines.push('--- DISCO ---');
  const exists = (relative) => fs.existsSync(path.join(projectDir, relative));
  lines.push(`raiz/blur-criado.txt (esperado true): ${exists('blur-criado.txt')}`);
  lines.push(`nao-criado.txt (esperado false): ${exists('nao-criado.txt')}`);
  lines.push(`pasta-raiz (esperado true): ${exists('pasta-raiz')}`);
  lines.push(`docs/dentro.js (esperado true): ${exists('docs/dentro.js')}`);
  lines.push(`docs/sub/aninhado.md (esperado true): ${exists(path.join('docs', 'sub', 'aninhado.md'))}`);
  lines.push(`docs/sub/pasta-com-barra (esperado true): ${exists(path.join('docs', 'sub', 'pasta-com-barra'))}`);
  lines.push(`erros de console: ${JSON.stringify(consoleErrors.filter((message) => !message.includes('Electron Security Warning')).slice(0, 8))}`);
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(lines.join('\n'));
  app.exit(0);
});

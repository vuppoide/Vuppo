const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
require(path.join(__dirname, 'main.js'));

const projectDir = path.join(os.tmpdir(), 'vuppo-inline-test');
const absoluteFile = path.join(projectDir, 'app.js');

app.whenReady().then(async () => {
  setTimeout(() => { console.log('TIMEOUT'); app.exit(3); }, 90000);
  fs.rmSync(projectDir, { recursive: true, force: true });
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(absoluteFile, 'const apiKey = "x";\n', 'utf8');
  const win = BrowserWindow.getAllWindows()[0];
  win.hide();
  if (win.webContents.isLoading()) await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  const consoleErrors = [];
  win.webContents.on('console-message', (_event, _level, message) => consoleErrors.push(message));
  await win.webContents.executeJavaScript(`window.__vuppoTest = ${JSON.stringify({ projectPath: projectDir, absoluteFile })};`);
  const pageTest = fs.readFileSync(path.join(os.tmpdir(), 'vuppo-inline-page-test.js'), 'utf8');
  let result;
  try {
    result = await win.webContents.executeJavaScript(pageTest);
  } catch (error) {
    result = [`executeJavaScript ERRO: ${error.message}`];
  }
  console.log('--- RESULTADO ---');
  for (const line of result) console.log(line);
  console.log('--- DISCO ---');
  console.log(`pasta docs/api: ${fs.existsSync(path.join(projectDir, 'docs', 'api'))}`);
  console.log(`arquivo docs/notas/leiame.md: ${fs.existsSync(path.join(projectDir, 'docs', 'notas', 'leiame.md'))}`);
  console.log(`pasta docs/interna: ${fs.existsSync(path.join(projectDir, 'docs', 'interna'))}`);
  console.log(`pasta somente-pasta: ${fs.existsSync(path.join(projectDir, 'somente-pasta'))}`);
  console.log(`nao-deve-existir.txt (esperado false): ${fs.existsSync(path.join(projectDir, 'nao-deve-existir.txt'))}`);
  console.log(`tambem-nao.txt (esperado false): ${fs.existsSync(path.join(projectDir, 'tambem-nao.txt'))}`);
  console.log(`console: ${JSON.stringify(consoleErrors.slice(0, 6))}`);
  app.exit(0);
});

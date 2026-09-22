const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
require(path.join(__dirname, 'main.js'));

const outFile = path.join(os.tmpdir(), 'vuppo-vscode-out.txt');
const lines = [];
const tmp = (...parts) => path.join(os.tmpdir(), ...parts);

const scenarios = [
  {
    name: 'criacao-inline-do-explorador',
    dir: 'vuppo-inline-test',
    pageTest: 'vuppo-vscode-page-test.js',
    prepare: (dir) => {
      fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'app.js'), 'const apiKey = "x";\n', 'utf8');
      return { projectPath: dir, absoluteFile: path.join(dir, 'app.js') };
    },
    checks: [
      ['blur-criado.txt', true],
      ['nao-criado.txt', false],
      ['pasta-raiz', true],
      ['docs/dentro.js', true],
      ['docs/sub/aninhado.md', true],
      ['docs/sub/pasta-com-barra', true]
    ]
  },
  {
    name: 'menu-de-contexto-estilo-vscode',
    dir: 'vuppo-menu-test',
    pageTest: 'vuppo-vscode-page-test2.js',
    prepare: (dir) => {
      fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'app.js'), 'const apiKey = "x";\n', 'utf8');
      fs.writeFileSync(path.join(dir, 'zeta.txt'), 'nota\n', 'utf8');
      fs.writeFileSync(path.join(dir, 'Nota.md'), '# nota\n', 'utf8');
      fs.writeFileSync(path.join(dir, 'docs', 'readme.md'), '# readme\n', 'utf8');
      return { projectPath: dir, absoluteFile: path.join(dir, 'app.js') };
    },
    checks: [
      ['documentacao/app.js', true],
      ['documentacao/readme.md', true],
      ['docs', false],
      ['app.js', false],
      ['servidor.js', false],
      ['sub/novo.js', true],
      ['zeta.txt', true],
      ['Nota.md', false]
    ]
  }
];

app.whenReady().then(async () => {
  setTimeout(() => {
    fs.writeFileSync(outFile, `${lines.join('\n')}\nTIMEOUT\n`, 'utf8');
    console.log('TIMEOUT');
    app.exit(3);
  }, 240000);
  const win = BrowserWindow.getAllWindows()[0];
  win.hide();
  if (win.webContents.isLoading()) await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  const consoleErrors = [];
  win.webContents.on('console-message', (_event, _level, message) => consoleErrors.push(message));

  for (const scenario of scenarios) {
    const dir = tmp(scenario.dir);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const info = scenario.prepare(dir);
    lines.push(`=== ${scenario.name} ===`);
    await win.webContents.executeJavaScript(`window.__vuppoTest = ${JSON.stringify(info)};`);
    let result;
    try {
      result = await win.webContents.executeJavaScript(fs.readFileSync(tmp(scenario.pageTest), 'utf8'));
    } catch (error) {
      result = [`executeJavaScript ERRO: ${error.message}`];
    }
    for (const line of result) lines.push(line);
    lines.push('--- DISCO ---');
    for (const [relative, expected] of scenario.checks) {
      const exists = fs.existsSync(path.join(dir, relative));
      lines.push(`${relative} (esperado ${expected}): ${exists} ${exists === expected ? 'OK' : 'FALHOU'}`);
    }
  }
  lines.push(`erros de console: ${JSON.stringify(consoleErrors.filter((message) => !message.includes('Electron Security Warning') && !message.includes('guestInstanceId')).slice(0, 8))}`);
  fs.writeFileSync(outFile, lines.join('\n'), 'utf8');
  console.log(lines.join('\n'));
  app.exit(0);
});

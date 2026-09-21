const fs = require('fs');
const path = require('path');

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'vendor']);
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py', '.java', '.go', '.rb', '.php', '.env', '.json', '.yml', '.yaml', '.sql', '.sh', '.html', '.htm', '.css', '.scss', '.sass', '.less', '.xml', '.md', '.txt']);
const IMAGE_MIMES = new Map([['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.jfif', 'image/jpeg'], ['.gif', 'image/gif'], ['.webp', 'image/webp'], ['.avif', 'image/avif'], ['.svg', 'image/svg+xml'], ['.ico', 'image/x-icon'], ['.bmp', 'image/bmp'], ['.tif', 'image/tiff'], ['.tiff', 'image/tiff']]);

const RULES = [
  { id: 'hardcoded-secret', title: 'Possível segredo exposto', severity: 'critical', category: 'Credenciais', pattern: /(?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*["'`]([A-Za-z0-9_\-/+=]{8,})["'`]/i, advice: 'Remova o valor do código, revogue a credencial e use variáveis de ambiente ou um cofre de segredos.' },
  { id: 'private-key', title: 'Chave privada no código', severity: 'critical', category: 'Credenciais', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, advice: 'Retire a chave do repositório imediatamente, revogue-a e armazene uma nova chave em um gerenciador de segredos.' },
  { id: 'dangerous-exec', title: 'Execução de comando controlada por entrada', severity: 'high', category: 'Injeção', pattern: /(?:child_process\.(?:exec|execSync)|os\.system|subprocess\.(?:run|Popen)|Runtime\.getRuntime\(\)\.exec)/, advice: 'Evite shell quando possível. Valide entradas com allowlist e prefira APIs que recebem argumentos separados.' },
  { id: 'eval', title: 'Uso de eval ou código dinâmico', severity: 'high', category: 'Injeção', pattern: /\beval\s*\(|new Function\s*\(/, advice: 'Remova a execução dinâmica. Use parsing estruturado e validação explícita do formato recebido.' },
  { id: 'unsafe-innerhtml', title: 'HTML inserido sem sanitização', severity: 'high', category: 'Cross-site scripting', pattern: /\.innerHTML\s*=|dangerouslySetInnerHTML/, advice: 'Sanitize o conteúdo antes de renderizar ou use APIs que tratem o texto como conteúdo, não como HTML.' },
  { id: 'weak-hash', title: 'Algoritmo de hash fraco', severity: 'medium', category: 'Criptografia', pattern: /(?:createHash\s*\(\s*["'](?:md5|sha1)|hashlib\.(?:md5|sha1)|MessageDigest\.getInstance\s*\(\s*["'](?:MD5|SHA-1))/i, advice: 'Use SHA-256 ou superior para integridade. Para senhas, use Argon2id, scrypt ou bcrypt com salt.' },
  { id: 'http-url', title: 'Comunicação sem HTTPS', severity: 'medium', category: 'Transporte', pattern: /["'`]http:\/\/(?!localhost|127\.0\.0\.1)/i, advice: 'Troque por HTTPS e valide certificados. Evite enviar dados sensíveis por conexões sem criptografia.' },
  { id: 'permissive-cors', title: 'CORS permissivo', severity: 'medium', category: 'Configuração', pattern: /(?:Access-Control-Allow-Origin|origin)\s*[:=]\s*["'`]\*["'`]/i, advice: 'Restrinja as origens permitidas a uma lista explícita de domínios confiáveis.' },
  { id: 'debug-enabled', title: 'Modo de debug em produção', severity: 'low', category: 'Configuração', pattern: /(?:DEBUG|debug)\s*[:=]\s*(?:true|1|["'`]true["'`])/i, advice: 'Desative debug no ambiente de produção para evitar vazamento de stack traces e configurações.' },
];

function collectFiles(root, files = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (IGNORED.has(entry.name)) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) collectFiles(fullPath, files);
    else files.push(fullPath);
  }
  return files;
}

function collectDirectories(root) {
  const directories = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (IGNORED.has(entry.name) || !entry.isDirectory()) continue;
      const fullPath = path.join(current, entry.name);
      directories.push(path.relative(root, fullPath));
      walk(fullPath);
    }
  };
  walk(root);
  return directories;
}

function isTextFile(filePath) {
  return EXTENSIONS.has(path.extname(filePath).toLowerCase()) || path.basename(filePath) === '.env';
}

function scanProject(projectPath) {
  if (!projectPath || !fs.existsSync(projectPath)) throw new Error('Pasta do projeto não encontrada.');
  const started = Date.now();
  const files = collectFiles(projectPath);
  const directories = collectDirectories(projectPath);
  const scannedFiles = [];
  const findings = [];
  const scanFiles = files.filter(isTextFile);
  for (const filePath of files) {
    let content;
    const mime = IMAGE_MIMES.get(path.extname(filePath).toLowerCase());
    try {
      const stats = fs.statSync(filePath);
      if (mime) {
        content = stats.size <= 5 * 1024 * 1024 ? `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}` : '';
      } else {
        content = fs.readFileSync(filePath, 'utf8');
      }
    } catch { content = ''; }
    scannedFiles.push({ file: path.relative(projectPath, filePath), absoluteFile: filePath, content, mime, isImage: Boolean(mime) });
  }
  for (const filePath of scanFiles) {
    let content;
    try { content = fs.readFileSync(filePath, 'utf8'); } catch { continue; }
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of RULES) {
        if (rule.pattern.test(line)) {
          findings.push({ id: `${rule.id}-${findings.length}`, ruleId: rule.id, title: rule.title, severity: rule.severity, category: rule.category, advice: rule.advice, file: path.relative(projectPath, filePath), absoluteFile: filePath, line: index + 1, excerpt: line.trim().slice(0, 180) });
        }
        rule.pattern.lastIndex = 0;
      }
    });
  }
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.file.localeCompare(b.file));
  return { projectPath, projectName: path.basename(projectPath), filesScanned: scannedFiles.length, analyzedFiles: scanFiles.length, directories, files: scannedFiles, findings, durationMs: Date.now() - started, scannedAt: new Date().toISOString() };
}

module.exports = { scanProject, IMAGE_MIMES };
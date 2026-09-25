const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const { scannerService } = require('./scannerService');

const MAX_FILE_SIZE = 500 * 1024; // 500 KB por leitura
const MAX_LIST_ENTRIES = 200;
const MAX_SEARCH_RESULTS = 30;
const COMMAND_TIMEOUT_MS = 30000;
const BLOCKED_COMMANDS = [
  /(^|[\s&|;])(rm\s+-rf|rd\s+\/s|format\s+[a-z]:|mkfs|dd\s+of=|shutdown|reboot|halt|poweroff)/i,
  /(^|[\s&|;])(reg\s+delete|bcdedit|diskpart|takeown|icacls.*\/deny)/i,
  /(__proto__|constructor\s*\[|prototype\s*\.\s*pollute)/i
];

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function resolveInside(rootDir, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim() || relativePath.includes('\0')) {
    throw fail('Caminho do arquivo inválido.', 400);
  }
  const root = path.resolve(rootDir);
  const target = path.resolve(root, relativePath);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw fail('Acesso negado: caminho fora do projeto.', 403);
  }
  return target;
}

function validateProjectDir(projectDir) {
  if (typeof projectDir !== 'string' || !projectDir.trim()) {
    throw fail('Nenhum projeto aberto. Peça ao usuário para abrir um projeto primeiro.', 400);
  }
  const root = path.resolve(projectDir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw fail('Projeto não encontrado no disco. Peça ao usuário para abrir o projeto novamente.', 400);
  }
  return root;
}

const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'ler_arquivo',
      description: 'Lê o conteúdo de um arquivo do projeto (caminho relativo à raiz). Use antes de editar ou explicar código.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo do arquivo, ex: "src/index.js"' },
          maxChars: { type: 'number', description: 'Limite de caracteres (padrão 8000)' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'listar_pasta',
      description: 'Lista arquivos e pastas de um diretório do projeto (caminho relativo, vazio = raiz).',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Caminho relativo da pasta (padrão: raiz)' } }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'buscar_no_codigo',
      description: 'Busca um termo ou regex nos arquivos de código do projeto.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Texto ou padrão regex a buscar' },
          regex: { type: 'boolean', description: 'Tratar query como regex (padrão false)' },
          maxResults: { type: 'number', description: 'Máximo de resultados (padrão 30)' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'auditar_arquivo',
      description: 'Roda o auditor de segurança VUPPO em um arquivo do projeto e retorna os achados.',
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Caminho relativo do arquivo' } },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'editar_arquivo',
      description: 'Cria ou sobrescreve um arquivo do projeto com o conteúdo informado. SEMPRE requer aprovação do usuário antes de executar.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho relativo do arquivo' },
          content: { type: 'string', description: 'Conteúdo completo do novo arquivo' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'executar_comando',
      description: 'Executa um comando de leitura/diagnóstico no terminal do projeto (ex: npm test, git status, dir). Comandos destrutivos são bloqueados. SEMPRE requer aprovação do usuário.',
      parameters: {
        type: 'object',
        properties: { command: { type: 'string', description: 'Comando a executar' } },
        required: ['command']
      }
    }
  }
];

// Ferramentas que exigem aprovação explícita do usuário antes de executar.
const APPROVAL_REQUIRED = new Set(['editar_arquivo', 'executar_comando']);

const agentTools = {
  tools: AGENT_TOOLS,
  requiresApproval(name) { return APPROVAL_REQUIRED.has(name); },
  describeCall(name, args) {
    const target = (args && (args.path || args.command || args.query)) || '';
    if (name === 'editar_arquivo') return `Editar/criar o arquivo "${target}"`;
    if (name === 'executar_comando') return `Executar o comando "${target}"`;
    if (name === 'ler_arquivo') return `Ler o arquivo "${target}"`;
    if (name === 'listar_pasta') return `Listar a pasta "${target || 'raiz do projeto'}"`;
    if (name === 'buscar_no_codigo') return `Buscar por "${target}" no código`;
    if (name === 'auditar_arquivo') return `Auditar a segurança de "${target}"`;
    return `Executar "${name}"`;
  },
  async execute(name, args, projectDir) {
    const root = validateProjectDir(projectDir);
    const params = args && typeof args === 'object' ? args : {};

    if (name === 'ler_arquivo') {
      const target = resolveInside(root, params.path);
      const stats = await fs.promises.stat(target).catch(() => null);
      if (!stats || !stats.isFile()) throw fail(`Arquivo não encontrado: ${params.path}`, 404);
      if (stats.size > MAX_FILE_SIZE) throw fail(`Arquivo muito grande (${Math.round(stats.size / 1024)} KB).`, 400);
      const content = await fs.promises.readFile(target, 'utf8');
      const limit = Math.min(Math.max(Number(params.maxChars) || 8000, 500), 60000);
      return content.length > limit ? `${content.slice(0, limit)}\n…[trecho truncado]` : content;
    }

    if (name === 'listar_pasta') {
      const target = params.path ? resolveInside(root, params.path) : root;
      const entries = await fs.promises.readdir(target, { withFileTypes: true }).catch(() => null);
      if (!entries) throw fail(`Pasta não encontrada: ${params.path || '(raiz)'}`, 404);
      return entries.slice(0, MAX_LIST_ENTRIES)
        .map((e) => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`)
        .join('\n') || '(pasta vazia)';
    }

    if (name === 'auditar_arquivo') {
      const target = resolveInside(root, params.path);
      const content = await fs.promises.readFile(target, 'utf8').catch(() => null);
      if (content === null) throw fail(`Arquivo não encontrado: ${params.path}`, 404);
      const report = scannerService.scanFiles([{ filename: params.path, content }], null);
      if (!report.findings.length) return 'Nenhuma vulnerabilidade encontrada pelo auditor VUPPO.';
      return report.findings
        .map((f) => `[${f.severity}] ${f.title} (linha ${f.line}): ${f.excerpt} — Correção: ${f.advice}`)
        .join('\n');
    }
    if (name === 'buscar_no_codigo') {
      const query = String(params.query || '');
      if (!query) throw fail('Informe o termo de busca.', 400);
      const useRegex = params.regex === true;
      let matcher = null;
      if (useRegex) { try { matcher = new RegExp(query, 'i'); } catch { throw fail('Regex inválida.', 400); } }
      const needle = query.toLowerCase();
      const maxR = Math.min(Math.max(Number(params.maxResults) || MAX_SEARCH_RESULTS, 1), 100);
      const results = [];
      const skip = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.kilo']);
      const walk = async (dir, prefix) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true }).catch(() => []);
        for (const entry of entries) {
          if (results.length >= maxR) return;
          if (skip.has(entry.name)) continue;
          const full = path.join(dir, entry.name);
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory()) { await walk(full, rel); continue; }
          if (!entry.isFile()) continue;
          let text = '';
          try {
            const stats = await fs.promises.stat(full);
            if (stats.size > MAX_FILE_SIZE) continue;
            text = await fs.promises.readFile(full, 'utf8');
            if (text.includes('\0')) continue;
          } catch { continue; }
          const lines = text.split(/\r?\n/);
          lines.forEach((line, index) => {
            if (results.length >= maxR) return;
            const hit = matcher ? matcher.test(line) : line.toLowerCase().includes(needle);
            if (hit) results.push(`${rel}:${index + 1}: ${line.trim().slice(0, 160)}`);
          });
        }
      };
      await walk(root, '');
      return results.length ? results.join('\n') : 'Nenhum resultado encontrado.';
    }

    if (name === 'editar_arquivo') {
      const target = resolveInside(root, params.path);
      const content = typeof params.content === 'string' ? params.content : '';
      if (!content) throw fail('Conteúdo vazio: nada para escrever.', 400);
      if (content.length > 1024 * 1024) throw fail('Conteúdo muito grande (máximo 1 MB).', 400);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await fs.promises.writeFile(target, content, 'utf8');
      return `Arquivo salvo: ${params.path} (${content.length} caracteres).`;
    }

    if (name === 'executar_comando') {
      const command = String(params.command || '').trim();
      if (!command) throw fail('Comando vazio.', 400);
      if (BLOCKED_COMMANDS.some((re) => re.test(command))) {
        throw fail('Comando bloqueado por segurança (destrutivo ou perigoso).', 403);
      }
      return await new Promise((resolve, reject) => {
        const runner = process.platform === 'win32'
          ? ['powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command]]
          : ['/bin/sh', ['-c', command]];
        execFile(runner[0], runner[1], { cwd: root, timeout: COMMAND_TIMEOUT_MS, windowsHide: true, maxBuffer: 2 * 1024 * 1024 }, (error, stdout, stderr) => {
          const output = `${stdout || ''}${stderr ? `\n[stderr]\n${stderr}` : ''}`.trim();
          if (error) reject(fail(`Comando falhou:\n${output.slice(0, 4000) || error.message}`, 400));
          else resolve(output.slice(0, 6000) || '(sem saída)');
        });
      });
    }

    throw fail(`Ferramenta desconhecida: ${name}`, 400);
  },
};

module.exports = { agentTools };


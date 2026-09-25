/* =============================================================================
 * Vuppo — Editor de código baseado no Monaco (o mesmo motor do VS Code).
 *
 * - Realce de sintaxe idêntico ao VS Code (tema "vuppo-dark" derivado do
 *   Dark+), cobrindo as 90+ linguagens embutidas no Monaco.
 * - Autocompletar em todas as linguagens:
 *     · JavaScript/TypeScript/JSON/CSS/HTML: IntelliSense real (o mesmo
 *       language service do VS Code, incluindo membros de objetos).
 *     · Demais linguagens: palavras-chave, snippets e palavras do documento.
 *
 * O editor legado (contenteditable) continua disponível como fallback via
 * config.fallback caso o Monaco não possa ser carregado.
 * ========================================================================== */
(function () {
  'use strict';

  const AMD_BASE = 'node_modules/monaco-editor/min/vs';
  const THEME = 'vuppo-dark';

  // Linguagens com IntelliSense "de verdade" (language service do VS Code).
  // Nelas só acrescentamos snippets; as palavras-chave já vêm do serviço nativo.
  const NATIVE_INTELLISENSE = new Set(['javascript', 'typescript', 'json', 'css', 'scss', 'less', 'html', 'handlebars', 'razor']);

  // Extensões/nomes conhecidos quando o catálogo do Monaco não cobre o arquivo.
  const FILE_LANGUAGE = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript', cjs: 'javascript',
    ts: 'typescript', tsx: 'typescript', mts: 'typescript', cts: 'typescript',
    py: 'python', pyw: 'python', rb: 'ruby', php: 'php', java: 'java',
    go: 'go', rs: 'rust', cs: 'csharp', kt: 'kotlin', kts: 'kotlin',
    swift: 'swift', dart: 'dart', lua: 'lua', r: 'r', pl: 'perl', pm: 'perl',
    scala: 'scala', sc: 'scala', clj: 'clojure', ex: 'elixir', exs: 'elixir',
    fs: 'fsharp', vb: 'vb', sol: 'sol',
    c: 'c', h: 'c', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', hpp: 'cpp',
    sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell', ps1: 'powershell', psm1: 'powershell', bat: 'bat', cmd: 'bat',
    sql: 'sql', mysql: 'mysql', pgsql: 'pgsql', graphql: 'graphql', gql: 'graphql',
    html: 'html', htm: 'html', xhtml: 'html', vue: 'html', svelte: 'html',
    css: 'css', scss: 'scss', sass: 'scss', less: 'less',
    xml: 'xml', xsd: 'xml', xslt: 'xml', svg: 'xml', plist: 'xml',
    json: 'json', jsonc: 'json', lock: 'json', map: 'json',
    yml: 'yaml', yaml: 'yaml', toml: 'ini', ini: 'ini', cfg: 'ini', conf: 'ini', properties: 'ini',
    md: 'markdown', markdown: 'markdown', mdx: 'mdx',
    dockerfile: 'dockerfile', tf: 'hcl', hcl: 'hcl', proto: 'protobuf',
    txt: 'plaintext', log: 'plaintext', csv: 'plaintext', env: 'ini',
  };

  // Arquivos sem extensão reconhecida pelo catálogo do Monaco.
  const FILE_NAME_LANGUAGE = {
    '.env': 'ini', '.gitignore': 'plaintext', '.editorconfig': 'ini',
    dockerfile: 'dockerfile', makefile: 'plaintext', gemfile: 'ruby', rakefile: 'ruby',
    'docker-compose.yml': 'yaml', 'docker-compose.yaml': 'yaml',
  };
  // Palavras-chave por linguagem usadas no autocompletar das linguagens sem
  // language service nativo (item "Keyword" na lista de sugestões).
  const KEYWORDS = {
    abap: ['REPORT', 'DATA', 'TYPES', 'WRITE', 'IF', 'ELSE', 'ENDIF', 'LOOP', 'ENDLOOP', 'FORM', 'ENDFORM', 'SELECT', 'FROM', 'INTO', 'INNER', 'JOIN', 'WHERE', 'MOVE', 'CLEAR', 'CALL', 'FUNCTION', 'METHOD'],
    apex: ['class', 'interface', 'trigger', 'public', 'private', 'protected', 'static', 'final', 'void', 'return', 'new', 'if', 'else', 'for', 'while', 'try', 'catch', 'finally', 'throw', 'select', 'from', 'where', 'insert', 'update', 'delete', 'list', 'map', 'set'],
    azcli: ['az', 'group', 'create', 'delete', 'list', 'show', 'account', 'login', 'storage', 'vm', 'resource', 'deployment'],
    bat: ['set', 'echo', 'if', 'else', 'for', 'in', 'do', 'goto', 'call', 'exit', 'rem', 'pause', 'cd', 'copy', 'move', 'del', 'start', 'errorlevel', 'defined', 'exist'],
    bicep: ['param', 'var', 'resource', 'module', 'output', 'targetScope', 'if', 'for', 'in', 'existing', 'dependsOn', 'location', 'properties', 'string', 'int', 'bool', 'array', 'object'],
    c: ['int', 'char', 'float', 'double', 'void', 'long', 'short', 'unsigned', 'signed', 'const', 'static', 'extern', 'struct', 'union', 'enum', 'typedef', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'sizeof', 'goto', 'include', 'define'],
    cpp: ['class', 'struct', 'public', 'private', 'protected', 'virtual', 'override', 'template', 'typename', 'namespace', 'using', 'new', 'delete', 'nullptr', 'constexpr', 'auto', 'return', 'if', 'else', 'for', 'while', 'switch', 'try', 'catch', 'throw', 'std', 'string', 'vector', 'map'],
    csharp: ['using', 'namespace', 'class', 'struct', 'interface', 'enum', 'public', 'private', 'protected', 'internal', 'static', 'readonly', 'const', 'void', 'var', 'new', 'return', 'if', 'else', 'for', 'foreach', 'while', 'switch', 'try', 'catch', 'finally', 'throw', 'async', 'await', 'string', 'int', 'bool', 'double', 'decimal', 'List', 'Task'],
    clojure: ['def', 'defn', 'let', 'if', 'cond', 'when', 'loop', 'recur', 'fn', 'map', 'reduce', 'filter', 'require', 'ns', 'println', 'str', 'assoc', 'get'],
    coffeescript: ['class', 'extends', 'constructor', 'return', 'if', 'else', 'unless', 'for', 'in', 'while', 'try', 'catch', 'throw', 'new', 'do', 'then', 'is', 'isnt', 'and', 'or', 'not'],
    cypher: ['MATCH', 'OPTIONAL', 'WHERE', 'RETURN', 'CREATE', 'MERGE', 'DELETE', 'DETACH', 'SET', 'WITH', 'UNWIND', 'LIMIT', 'ORDER', 'BY', 'SKIP', 'AS', 'AND', 'OR', 'NOT', 'IN', 'COUNT', 'COLLECT'],
    dart: ['class', 'extends', 'implements', 'with', 'mixin', 'abstract', 'final', 'const', 'var', 'late', 'static', 'void', 'int', 'double', 'String', 'bool', 'List', 'Map', 'Future', 'async', 'await', 'return', 'if', 'else', 'for', 'while', 'switch', 'try', 'catch', 'throw', 'new', 'import'],
    dockerfile: ['FROM', 'RUN', 'CMD', 'LABEL', 'EXPOSE', 'ENV', 'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOPSIGNAL', 'HEALTHCHECK', 'SHELL', 'AS'],
    elixir: ['defmodule', 'def', 'defp', 'defstruct', 'do', 'end', 'case', 'cond', 'if', 'unless', 'for', 'with', 'try', 'rescue', 'raise', 'import', 'alias', 'use', 'require', 'Enum', 'Map', 'List', 'String', 'IO', 'nil', 'true', 'false'],
    fsharp: ['let', 'match', 'with', 'type', 'module', 'namespace', 'open', 'member', 'interface', 'inherit', 'if', 'then', 'else', 'elif', 'for', 'in', 'while', 'do', 'try', 'finally', 'async', 'return', 'yield', 'fun', 'function'],
    go: ['package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'select', 'range', 'return', 'if', 'else', 'for', 'switch', 'case', 'break', 'continue', 'fallthrough', 'nil', 'true', 'false', 'make', 'new', 'len', 'cap', 'append', 'error'],
    graphql: ['query', 'mutation', 'subscription', 'fragment', 'type', 'input', 'enum', 'interface', 'union', 'schema', 'scalar', 'directive', 'extend', 'on', 'implements', 'true', 'false', 'null'],
    hcl: ['resource', 'data', 'variable', 'output', 'module', 'provider', 'terraform', 'locals', 'for_each', 'count', 'depends_on', 'dynamic', 'true', 'false', 'null'],
    ini: ['true', 'false', 'on', 'off', 'yes', 'no', 'null', 'none', 'debug', 'host', 'port', 'user', 'password', 'path'],
    java: ['public', 'private', 'protected', 'class', 'interface', 'enum', 'extends', 'implements', 'static', 'final', 'abstract', 'synchronized', 'volatile', 'transient', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'String', 'var', 'new', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws', 'import', 'package', 'this', 'super', 'null', 'true', 'false', 'instanceof'],
    julia: ['function', 'end', 'if', 'else', 'elseif', 'for', 'while', 'begin', 'let', 'struct', 'mutable', 'module', 'using', 'import', 'export', 'return', 'try', 'catch', 'finally', 'const', 'global', 'local', 'true', 'false', 'nothing', 'where'],
    kotlin: ['fun', 'val', 'var', 'class', 'object', 'interface', 'data', 'sealed', 'enum', 'companion', 'init', 'constructor', 'override', 'open', 'abstract', 'private', 'protected', 'internal', 'public', 'suspend', 'inline', 'when', 'if', 'else', 'for', 'while', 'do', 'try', 'catch', 'finally', 'throw', 'return', 'null', 'true', 'false', 'import', 'package', 'this', 'super', 'it'],
    lua: ['function', 'end', 'local', 'if', 'then', 'elseif', 'else', 'for', 'while', 'repeat', 'until', 'do', 'return', 'break', 'nil', 'true', 'false', 'and', 'or', 'not', 'require', 'print', 'pairs', 'ipairs', 'table', 'string', 'math'],
    markdown: ['# ', '## ', '### ', '#### ', '---', '***', '> ', '- ', '* ', '1. ', '```', '|', '[texto](url)', '![alt](url)', '- [ ] ', '- [x] '],
    'objective-c': ['@interface', '@implementation', '@end', '@property', '@synthesize', '@dynamic', '@class', '@protocol', '@selector', '@try', '@catch', '@finally', '@autoreleasepool', 'NSString', 'NSArray', 'NSDictionary', 'NSNumber', 'self', 'super', 'nil', 'YES', 'NO'],
    pascal: ['program', 'unit', 'interface', 'implementation', 'uses', 'begin', 'end', 'var', 'const', 'type', 'procedure', 'function', 'if', 'then', 'else', 'case', 'of', 'for', 'to', 'downto', 'do', 'while', 'repeat', 'until', 'record', 'array', 'string', 'integer', 'boolean'],
    perl: ['my', 'our', 'local', 'sub', 'package', 'use', 'require', 'if', 'elsif', 'else', 'unless', 'while', 'until', 'for', 'foreach', 'do', 'return', 'last', 'next', 'die', 'warn', 'print', 'say', 'open', 'close', 'shift', 'push', 'pop', 'defined', 'undef'],
    php: ['function', 'class', 'interface', 'trait', 'extends', 'implements', 'public', 'private', 'protected', 'static', 'final', 'abstract', 'const', 'namespace', 'use', 'new', 'return', 'if', 'else', 'elseif', 'foreach', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'echo', 'print', 'require', 'include', 'null', 'true', 'false', 'array', 'string', 'int', 'float', 'bool', 'void'],
    powershell: ['function', 'param', 'if', 'else', 'elseif', 'switch', 'foreach', 'for', 'while', 'do', 'until', 'try', 'catch', 'finally', 'throw', 'return', 'break', 'continue', 'class', 'enum', 'using', 'module', 'import', 'export', 'Write-Host', 'Write-Output', 'Get-ChildItem', 'Get-Content', 'Set-Content', 'Get-Process', 'Where-Object', 'ForEach-Object', 'Select-Object', '$true', '$false', '$null'],
    protobuf: ['syntax', 'package', 'import', 'message', 'enum', 'service', 'rpc', 'returns', 'repeated', 'optional', 'required', 'string', 'int32', 'int64', 'bool', 'bytes', 'double', 'float', 'map', 'oneof', 'reserved'],
    python: ['def', 'class', 'return', 'yield', 'import', 'from', 'as', 'if', 'elif', 'else', 'for', 'while', 'break', 'continue', 'pass', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'global', 'nonlocal', 'assert', 'del', 'and', 'or', 'not', 'in', 'is', 'None', 'True', 'False', 'async', 'await', 'self', 'print', 'len', 'range', 'enumerate', 'zip', 'dict', 'list', 'set', 'tuple', 'str', 'int', 'float', 'bool'],
    r: ['function', 'if', 'else', 'for', 'while', 'repeat', 'break', 'next', 'return', 'library', 'require', 'install.packages', 'data.frame', 'matrix', 'vector', 'list', 'factor', 'TRUE', 'FALSE', 'NULL', 'NA', 'print', 'summary'],
    ruby: ['def', 'end', 'class', 'module', 'if', 'elsif', 'else', 'unless', 'while', 'until', 'for', 'in', 'do', 'begin', 'rescue', 'ensure', 'raise', 'return', 'yield', 'require', 'require_relative', 'include', 'extend', 'attr_accessor', 'attr_reader', 'attr_writer', 'new', 'nil', 'true', 'false', 'self', 'puts', 'print', 'each', 'map', 'select', 'reject'],
    rust: ['fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'trait', 'impl', 'pub', 'use', 'mod', 'crate', 'match', 'if', 'else', 'for', 'in', 'while', 'loop', 'break', 'continue', 'return', 'async', 'await', 'move', 'where', 'unsafe', 'dyn', 'ref', 'self', 'Self', 'super', 'as', 'Some', 'None', 'Ok', 'Err', 'true', 'false', 'String', 'Vec', 'Option', 'Result'],
    scala: ['def', 'val', 'var', 'class', 'object', 'trait', 'case', 'match', 'extends', 'with', 'override', 'abstract', 'final', 'sealed', 'implicit', 'lazy', 'private', 'protected', 'import', 'package', 'new', 'return', 'if', 'else', 'for', 'while', 'try', 'catch', 'finally', 'throw', 'yield', 'true', 'false', 'null', 'Unit', 'Int', 'String', 'List', 'Map', 'Option'],
    scheme: ['define', 'lambda', 'let', 'if', 'cond', 'else', 'begin', 'set!', 'quote', 'car', 'cdr', 'cons', 'list', 'display', 'newline', '#t', '#f'],
    shell: ['if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', 'case', 'esac', 'function', 'return', 'exit', 'local', 'export', 'readonly', 'read', 'echo', 'printf', 'cd', 'pwd', 'ls', 'mkdir', 'rm', 'cp', 'mv', 'grep', 'sed', 'awk', 'cat', 'chmod', 'source', 'test', 'set', 'shift', 'trap'],
    sol: ['pragma', 'solidity', 'contract', 'interface', 'library', 'function', 'modifier', 'event', 'struct', 'enum', 'mapping', 'public', 'private', 'internal', 'external', 'view', 'pure', 'payable', 'returns', 'return', 'require', 'assert', 'revert', 'emit', 'new', 'delete', 'if', 'else', 'for', 'while', 'constructor', 'msg', 'block', 'tx', 'address', 'uint256', 'string', 'bool', 'bytes'],
    sql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'CREATE', 'TABLE', 'ALTER', 'DROP', 'INDEX', 'VIEW', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'ON', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'DISTINCT', 'AS', 'AND', 'OR', 'NOT', 'NULL', 'IS', 'IN', 'BETWEEN', 'LIKE', 'UNION', 'ALL', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'DEFAULT', 'CONSTRAINT', 'BEGIN', 'COMMIT', 'ROLLBACK'],
    mysql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'DATABASE', 'ALTER', 'DROP', 'JOIN', 'LEFT', 'INNER', 'GROUP', 'ORDER', 'BY', 'LIMIT', 'SHOW', 'DESCRIBE', 'USE', 'VALUES', 'SET', 'AUTO_INCREMENT', 'ENGINE', 'IF', 'EXISTS'],
    pgsql: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'TABLE', 'RETURNING', 'JOIN', 'GROUP', 'ORDER', 'BY', 'LIMIT', 'SERIAL', 'PRIMARY', 'KEY', 'CONSTRAINT', 'CASCADE', 'BEGIN', 'COMMIT', 'ROLLBACK'],
    swift: ['func', 'var', 'let', 'class', 'struct', 'enum', 'protocol', 'extension', 'init', 'deinit', 'self', 'super', 'guard', 'if', 'else', 'switch', 'case', 'default', 'for', 'in', 'while', 'repeat', 'return', 'break', 'continue', 'try', 'catch', 'throw', 'throws', 'async', 'await', 'public', 'private', 'internal', 'fileprivate', 'open', 'static', 'final', 'override', 'nil', 'true', 'false', 'import', 'String', 'Int', 'Double', 'Bool', 'Array', 'Dictionary', 'Optional'],
    tcl: ['proc', 'set', 'if', 'then', 'elseif', 'else', 'for', 'foreach', 'while', 'switch', 'break', 'continue', 'return', 'expr', 'list', 'lindex', 'llength', 'string', 'puts', 'incr', 'global', 'upvar', 'catch'],
    vb: ['Dim', 'As', 'Sub', 'Function', 'End', 'If', 'Then', 'Else', 'ElseIf', 'For', 'Each', 'Next', 'While', 'Wend', 'Do', 'Loop', 'Select', 'Case', 'Try', 'Catch', 'Finally', 'Throw', 'Return', 'Class', 'Module', 'Public', 'Private', 'Protected', 'Shared', 'Static', 'New', 'Nothing', 'True', 'False', 'Imports', 'Namespace'],
    xml: ['xml', 'version', 'encoding', 'standalone', 'xmlns', 'schemaLocation', 'CDATA', 'true', 'false'],
    yaml: ['true', 'false', 'null', 'yes', 'no', 'on', 'off', 'version', 'name', 'description', 'services', 'image', 'container_name', 'ports', 'volumes', 'environment', 'depends_on', 'build', 'restart', 'networks', 'jobs', 'steps', 'runs-on', 'uses', 'run'],
  };
  // Snippets por linguagem (item "Snippet" na lista de sugestões). O texto usa
  // a sintaxe de snippet do Monaco: ${1:lugar}, $0 e \n/\t.
  const SNIPPETS = {
    javascript: [
      { label: 'log', detail: 'console.log', insertText: "console.log(${1:valor});" },
      { label: 'fn', detail: 'function', insertText: "function ${1:nome}(${2:parametros}) {\n\t$0\n}" },
      { label: 'arrow', detail: 'arrow function', insertText: "const ${1:nome} = (${2:parametros}) => {\n\t$0\n};" },
      { label: 'class', detail: 'class', insertText: "class ${1:Nome} {\n\tconstructor(${2:parametros}) {\n\t\t$0\n\t}\n}" },
      { label: 'if', detail: 'if', insertText: "if (${1:condicao}) {\n\t$0\n}" },
      { label: 'for', detail: 'for', insertText: "for (let ${1:i} = 0; ${1:i} < ${2:limite}; ${1:i}++) {\n\t$0\n}" },
      { label: 'trycatch', detail: 'try/catch', insertText: "try {\n\t$0\n} catch (error) {\n\tconsole.error(error);\n}" },
      { label: 'import', detail: 'import', insertText: "import ${1:modulo} from '${2:caminho}';" },
      { label: 'fetch', detail: 'fetch JSON', insertText: "const resposta = await fetch('${1:url}');\nconst dados = await resposta.json();$0" },
      { label: 'puppeteer', detail: 'Puppeteer: abrir página', insertText: "const browser = await puppeteer.launch({ headless: false });\nconst page = await browser.newPage();\nawait page.goto('${1:url}', { waitUntil: 'networkidle2' });$0" },
    ],
    typescript: [
      { label: 'log', detail: 'console.log', insertText: "console.log(${1:valor});" },
      { label: 'fn', detail: 'function tipada', insertText: "function ${1:nome}(${2:parametros}): ${3:void} {\n\t$0\n}" },
      { label: 'interface', detail: 'interface', insertText: "interface ${1:Nome} {\n\t${2:campo}: ${3:string};\n}" },
      { label: 'type', detail: 'type alias', insertText: "type ${1:Nome} = {\n\t${2:campo}: ${3:string};\n};" },
      { label: 'class', detail: 'class', insertText: "export class ${1:Nome} {\n\tconstructor(private ${2:dependencia}: ${3:Tipo}) {}\n\n\t$0\n}" },
      { label: 'asyncfn', detail: 'async function', insertText: "async function ${1:nome}(${2:parametros}): Promise<${3:void}> {\n\t$0\n}" },
      { label: 'trycatch', detail: 'try/catch', insertText: "try {\n\t$0\n} catch (error) {\n\tconsole.error(error);\n}" },
    ],
    python: [
      { label: 'def', detail: 'def', insertText: "def ${1:nome}(${2:parametros}):\n\t$0" },
      { label: 'class', detail: 'class', insertText: "class ${1:Nome}:\n\tdef __init__(self${2:, parametros}):\n\t\t$0" },
      { label: 'ifmain', detail: 'main guard', insertText: "if __name__ == '__main__':\n\t$0" },
      { label: 'for', detail: 'for', insertText: "for ${1:item} in ${2:colecao}:\n\t$0" },
      { label: 'try', detail: 'try/except', insertText: "try:\n\t$0\nexcept ${1:Exception} as erro:\n\tprint(erro)" },
      { label: 'with', detail: 'with open', insertText: "with open('${1:arquivo}', '${2:r}', encoding='utf-8') as arquivo:\n\t$0" },
      { label: 'print', detail: 'print', insertText: "print(${1:valor})" },
      { label: 'requests', detail: 'requests GET', insertText: "import requests\n\nresposta = requests.get('${1:url}', timeout=${2:10})\nresposta.raise_for_status()\n$0" },
    ],
    java: [
      { label: 'main', detail: 'método main', insertText: "public static void main(String[] args) {\n\t$0\n}" },
      { label: 'class', detail: 'classe', insertText: "public class ${1:Nome} {\n\t$0\n}" },
      { label: 'sysout', detail: 'System.out.println', insertText: "System.out.println(${1:valor});" },
      { label: 'for', detail: 'for', insertText: "for (int ${1:i} = 0; ${1:i} < ${2:limite}; ${1:i}++) {\n\t$0\n}" },
      { label: 'trycatch', detail: 'try/catch', insertText: "try {\n\t$0\n} catch (${1:Exception} erro) {\n\terro.printStackTrace();\n}" },
    ],
    c: [
      { label: 'main', detail: 'função main', insertText: "int main(int argc, char **argv) {\n\t$0\n\treturn 0;\n}" },
      { label: 'include', detail: '#include', insertText: "#include <${1:stdio.h}>" },
      { label: 'for', detail: 'for', insertText: "for (int ${1:i} = 0; ${1:i} < ${2:limite}; ${1:i}++) {\n\t$0\n}" },
      { label: 'if', detail: 'if', insertText: "if (${1:condicao}) {\n\t$0\n}" },
      { label: 'struct', detail: 'struct', insertText: "typedef struct {\n\t$0\n} ${1:Nome};" },
    ],
    cpp: [
      { label: 'main', detail: 'função main', insertText: "int main() {\n\t$0\n\treturn 0;\n}" },
      { label: 'class', detail: 'classe', insertText: "class ${1:Nome} {\npublic:\n\t${1:Nome}();\n\t~${1:Nome}();\n\nprivate:\n\t$0\n};" },
      { label: 'include', detail: '#include', insertText: "#include <${1:iostream}>" },
      { label: 'for', detail: 'range for', insertText: "for (const auto &${1:item} : ${2:colecao}) {\n\t$0\n}" },
      { label: 'cout', detail: 'std::cout', insertText: "std::cout << ${1:valor} << std::endl;" },
    ],
    csharp: [
      { label: 'main', detail: 'método Main', insertText: "public static void Main(string[] args) {\n\t$0\n}" },
      { label: 'class', detail: 'classe', insertText: "public class ${1:Nome} {\n\t$0\n}" },
      { label: 'cw', detail: 'Console.WriteLine', insertText: "Console.WriteLine(${1:valor});" },
      { label: 'for', detail: 'foreach', insertText: "foreach (var ${1:item} in ${2:colecao}) {\n\t$0\n}" },
      { label: 'trycatch', detail: 'try/catch', insertText: "try {\n\t$0\n} catch (Exception erro) {\n\tConsole.WriteLine(erro.Message);\n}" },
    ],
    go: [
      { label: 'main', detail: 'package main', insertText: "package main\n\nimport \"fmt\"\n\nfunc main() {\n\t$0\n}" },
      { label: 'func', detail: 'função', insertText: "func ${1:nome}(${2:parametros}) ${3:error} {\n\t$0\n}" },
      { label: 'iferr', detail: 'tratamento de erro', insertText: "if err != nil {\n\treturn ${1:err}\n}" },
      { label: 'struct', detail: 'struct', insertText: "type ${1:Nome} struct {\n\t$0\n}" },
      { label: 'for', detail: 'for range', insertText: "for ${1:i}, ${2:item} := range ${3:colecao} {\n\t$0\n}" },
      { label: 'goroutine', detail: 'goroutine', insertText: "go func() {\n\t$0\n}()" },
    ],
    rust: [
      { label: 'main', detail: 'fn main', insertText: "fn main() {\n\t$0\n}" },
      { label: 'fn', detail: 'fn', insertText: "fn ${1:nome}(${2:parametros}) -> ${3:()} {\n\t$0\n}" },
      { label: 'struct', detail: 'struct', insertText: "struct ${1:Nome} {\n\t$0\n}" },
      { label: 'impl', detail: 'impl', insertText: "impl ${1:Nome} {\n\t$0\n}" },
      { label: 'match', detail: 'match', insertText: "match ${1:valor} {\n\t${2:padrao} => ${3:resultado},\n\t_ => $0,\n}" },
      { label: 'for', detail: 'for', insertText: "for ${1:item} in ${2:colecao} {\n\t$0\n}" },
    ],
    ruby: [
      { label: 'def', detail: 'def', insertText: "def ${1:nome}(${2:parametros})\n\t$0\nend" },
      { label: 'class', detail: 'class', insertText: "class ${1:Nome}\n\tdef initialize(${2:parametros})\n\t\t$0\n\tend\nend" },
      { label: 'each', detail: 'each', insertText: "${1:colecao}.each do |${2:item}|\n\t$0\nend" },
      { label: 'if', detail: 'if/else', insertText: "if ${1:condicao}\n\t$0\nelse\n\t\nend" },
      { label: 'puts', detail: 'puts', insertText: "puts ${1:valor}" },
    ],
    php: [
      { label: 'php', detail: 'abertura', insertText: "<?php\n\n$0" },
      { label: 'func', detail: 'function', insertText: "function ${1:nome}(${2:parametros}) {\n\t$0\n}" },
      { label: 'class', detail: 'class', insertText: "class ${1:Nome}\n{\n\tpublic function __construct(${2:parametros})\n\t{\n\t\t$0\n\t}\n}" },
      { label: 'foreach', detail: 'foreach', insertText: "foreach ($${1:colecao} as $${2:item}) {\n\t$0\n}" },
      { label: 'trycatch', detail: 'try/catch', insertText: "try {\n\t$0\n} catch (\\Throwable $erro) {\n\terror_log($erro->getMessage());\n}" },
    ],
    shell: [
      { label: 'shebang', detail: '#! /usr/bin/env bash', insertText: "#!/usr/bin/env bash\nset -euo pipefail\n\n$0" },
      { label: 'if', detail: 'if', insertText: "if [[ ${1:condicao} ]]; then\n\t$0\nfi" },
      { label: 'for', detail: 'for', insertText: "for ${1:item} in ${2:lista}; do\n\t$0\ndone" },
      { label: 'func', detail: 'função', insertText: "${1:nome}() {\n\t$0\n}" },
      { label: 'case', detail: 'case', insertText: "case \"$${1:variavel}\" in\n\t${2:padrao}) $0 ;;\n\t*) ;;\nesac" },
    ],
    powershell: [
      { label: 'param', detail: 'param()', insertText: "param(\n\t[Parameter(Mandatory = $true)]\n\t[string]$${1:Nome}\n)\n$0" },
      { label: 'func', detail: 'function', insertText: "function ${1:Nome} {\n\t[CmdletBinding()]\n\tparam(${2:parametros})\n\t$0\n}" },
      { label: 'if', detail: 'if', insertText: "if (${1:condicao}) {\n\t$0\n}" },
      { label: 'foreach', detail: 'foreach', insertText: "foreach ($item in $${1:colecao}) {\n\t$0\n}" },
      { label: 'trycatch', detail: 'try/catch', insertText: "try {\n\t$0\n} catch {\n\tWrite-Error $_.Exception.Message\n}" },
    ],
    sql: [
      { label: 'select', detail: 'SELECT', insertText: "SELECT ${1:*}\nFROM ${2:tabela}\nWHERE ${3:condicao};$0" },
      { label: 'insert', detail: 'INSERT', insertText: "INSERT INTO ${1:tabela} (${2:colunas})\nVALUES (${3:valores});$0" },
      { label: 'update', detail: 'UPDATE', insertText: "UPDATE ${1:tabela}\nSET ${2:coluna} = ${3:valor}\nWHERE ${4:condicao};$0" },
      { label: 'delete', detail: 'DELETE', insertText: "DELETE FROM ${1:tabela}\nWHERE ${2:condicao};$0" },
      { label: 'createtable', detail: 'CREATE TABLE', insertText: "CREATE TABLE ${1:tabela} (\n\t${2:id} ${3:SERIAL PRIMARY KEY},\n\t$0\n);" },
      { label: 'join', detail: 'INNER JOIN', insertText: "SELECT ${1:a.*}\nFROM ${2:tabela_a} a\nINNER JOIN ${3:tabela_b} b ON b.${4:id} = a.${5:tabela_a_id}\nWHERE ${6:condicao};$0" },
    ],
    html: [
      { label: 'html5', detail: 'documento HTML5', insertText: "<!doctype html>\n<html lang=\"pt-BR\">\n<head>\n\t<meta charset=\"UTF-8\" />\n\t<title>${1:Titulo}</title>\n</head>\n<body>\n\t$0\n</body>\n</html>" },
      { label: 'div', detail: 'div com classe', insertText: "<div class=\"${1:classe}\">\n\t$0\n</div>" },
      { label: 'a', detail: 'link', insertText: "<a href=\"${1:url}\">${2:texto}</a>$0" },
      { label: 'img', detail: 'imagem', insertText: "<img src=\"${1:src}\" alt=\"${2:descricao}\" />$0" },
      { label: 'form', detail: 'formulário', insertText: "<form action=\"${1:url}\" method=\"${2:post}\">\n\t$0\n</form>" },
    ],
    css: [
      { label: 'rule', detail: 'regra', insertText: ".${1:seletor} {\n\t$0\n}" },
      { label: 'flex', detail: 'flexbox', insertText: "display: flex;\nalign-items: center;\njustify-content: space-between;\ngap: ${1:8px};" },
      { label: 'grid', detail: 'grid', insertText: "display: grid;\ngrid-template-columns: repeat(${1:3}, minmax(0, 1fr));\ngap: ${2:16px};" },
      { label: 'media', detail: '@media', insertText: "@media (max-width: ${1:768px}) {\n\t$0\n}" },
      { label: 'root', detail: 'custom properties', insertText: ":root {\n\t--${1:cor}: ${2:#fff};\n}\n$0" },
    ],
    scss: [
      { label: 'mixin', detail: '@mixin', insertText: "@mixin ${1:nome}(${2:parametros}) {\n\t$0\n}" },
      { label: 'include', detail: '@include', insertText: "@include ${1:nome}(${2:arg});$0" },
      { label: 'variable', detail: 'variável', insertText: "$${1:nome}: ${2:valor};$0" },
      { label: 'media', detail: '@media', insertText: "@media (max-width: ${1:768px}) {\n\t$0\n}" },
    ],
    less: [
      { label: 'mixin', detail: 'mixin', insertText: ".${1:nome}(${2:parametros}) {\n\t$0\n}" },
      { label: 'variable', detail: 'variável', insertText: "@${1:nome}: ${2:valor};$0" },
      { label: 'media', detail: '@media', insertText: "@media (max-width: ${1:768px}) {\n\t$0\n}" },
    ],
    yaml: [
      { label: 'service', detail: 'serviço docker-compose', insertText: "${1:nome}:\n  image: ${2:imagem}\n  container_name: ${1:nome}\n  restart: unless-stopped\n  ports:\n    - \"${3:8080}:${4:80}\"\n  $0" },
      { label: 'job', detail: 'job de CI', insertText: "${1:build}:\n  runs-on: ubuntu-latest\n  steps:\n    - uses: actions/checkout@v4\n    - run: ${2:npm ci}\n    $0" },
      { label: 'key', detail: 'chave', insertText: "${1:chave}: ${2:valor}$0" },
    ],
    markdown: [
      { label: 'heading', detail: 'título', insertText: "## ${1:Titulo}\n\n$0" },
      { label: 'link', detail: 'link', insertText: "[${1:texto}](${2:url})$0" },
      { label: 'image', detail: 'imagem', insertText: "![${1:alt}](${2:url})$0" },
      { label: 'code', detail: 'bloco de código', insertText: "```${1:linguagem}\n$0\n```" },
      { label: 'table', detail: 'tabela', insertText: "| ${1:Coluna A} | ${2:Coluna B} |\n| --- | --- |\n| $0 |  |" },
      { label: 'task', detail: 'checklist', insertText: "- [ ] ${1:tarefa}\n$0" },
    ],
    dockerfile: [
      { label: 'from', detail: 'FROM', insertText: "FROM ${1:node:20-alpine}\n\nWORKDIR /app\n\n$0" },
      { label: 'node', detail: 'imagem Node completa', insertText: "FROM node:20-alpine\n\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY . .\nEXPOSE ${1:3000}\nCMD [\"node\", \"${2:server.js}\"]$0" },
      { label: 'run', detail: 'RUN', insertText: "RUN ${1:comando}$0" },
      { label: 'copy', detail: 'COPY', insertText: "COPY ${1:origem} ${2:destino}$0" },
      { label: 'env', detail: 'ENV', insertText: "ENV ${1:NOME}=${2:valor}$0" },
    ],
    kotlin: [
      { label: 'main', detail: 'fun main', insertText: "fun main() {\n\t$0\n}" },
      { label: 'fun', detail: 'função', insertText: "fun ${1:nome}(${2:parametros}): ${3:Unit} {\n\t$0\n}" },
      { label: 'class', detail: 'classe', insertText: "class ${1:Nome}(${2:parametros}) {\n\t$0\n}" },
      { label: 'when', detail: 'when', insertText: "when (${1:valor}) {\n\t${2:caso} -> $0\n\telse -> {}\n}" },
    ],
    swift: [
      { label: 'func', detail: 'func', insertText: "func ${1:nome}(${2:parametros}) -> ${3:Void} {\n\t$0\n}" },
      { label: 'class', detail: 'classe', insertText: "class ${1:Nome} {\n\tinit(${2:parametros}) {\n\t\t$0\n\t}\n}" },
      { label: 'guard', detail: 'guard let', insertText: "guard let ${1:valor} = ${2:opcional} else {\n\treturn\n}\n$0" },
      { label: 'for', detail: 'for in', insertText: "for ${1:item} in ${2:colecao} {\n\t$0\n}" },
    ],
    dart: [
      { label: 'main', detail: 'void main', insertText: "void main() {\n\t$0\n}" },
      { label: 'class', detail: 'classe', insertText: "class ${1:Nome} {\n\t${1:Nome}(${2:parametros});\n\n\t$0\n}" },
      { label: 'future', detail: 'Future assíncrono', insertText: "Future<${1:void}> ${2:nome}() async {\n\t$0\n}" },
      { label: 'for', detail: 'for in', insertText: "for (final ${1:item} in ${2:colecao}) {\n\t$0\n}" },
    ],
    lua: [
      { label: 'func', detail: 'function', insertText: "function ${1:nome}(${2:parametros})\n\t$0\nend" },
      { label: 'if', detail: 'if', insertText: "if ${1:condicao} then\n\t$0\nend" },
      { label: 'for', detail: 'for', insertText: "for ${1:i} = 1, ${2:limite} do\n\t$0\nend" },
      { label: 'local', detail: 'local', insertText: "local ${1:nome} = ${2:valor}$0" },
    ],
    r: [
      { label: 'func', detail: 'function', insertText: "${1:nome} <- function(${2:parametros}) {\n\t$0\n}" },
      { label: 'if', detail: 'if/else', insertText: "if (${1:condicao}) {\n\t$0\n} else {\n\t\n}" },
      { label: 'for', detail: 'for', insertText: "for (${1:item} in ${2:colecao}) {\n\t$0\n}" },
      { label: 'df', detail: 'data.frame', insertText: "${1:dados} <- data.frame(\n\t${2:coluna} = ${3:valor}\n)$0" },
    ],
    scala: [
      { label: 'def', detail: 'def', insertText: "def ${1:nome}(${2:parametros}): ${3:Unit} = {\n\t$0\n}" },
      { label: 'class', detail: 'classe', insertText: "class ${1:Nome}(${2:parametros}) {\n\t$0\n}" },
      { label: 'object', detail: 'object', insertText: "object ${1:Nome} {\n\tdef main(args: Array[String]): Unit = {\n\t\t$0\n\t}\n}" },
      { label: 'match', detail: 'match', insertText: "${1:valor} match {\n\tcase ${2:padrao} => $0\n\tcase _ =>\n}" },
    ],
    perl: [
      { label: 'sub', detail: 'sub', insertText: "sub ${1:nome} {\n\tmy (${2:parametros}) = @_;\n\t$0\n}" },
      { label: 'if', detail: 'if/else', insertText: "if (${1:condicao}) {\n\t$0\n} else {\n\t\n}" },
      { label: 'foreach', detail: 'foreach', insertText: "foreach my ${1:item} (@${2:colecao}) {\n\t$0\n}" },
    ],
    graphql: [
      { label: 'query', detail: 'query', insertText: "query ${1:Nome} {\n\t$0\n}" },
      { label: 'mutation', detail: 'mutation', insertText: "mutation ${1:Nome}(${2:entrada}: ${3:Tipo!}) {\n\t$0\n}" },
      { label: 'type', detail: 'type', insertText: "type ${1:Nome} {\n\t${2:id}: ID!\n\t$0\n}" },
    ],
    bat: [
      { label: 'echo', detail: 'echo', insertText: "echo ${1:texto}$0" },
      { label: 'if', detail: 'if', insertText: "if ${1:condicao} (\n\t$0\n)" },
      { label: 'for', detail: 'for', insertText: "for %%${1:i} in (${2:lista}) do (\n\t$0\n)" },
    ],
    ini: [
      { label: 'section', detail: 'seção', insertText: "[${1:secao}]\n${2:chave}=${3:valor}$0" },
      { label: 'key', detail: 'chave', insertText: "${1:chave}=${2:valor}$0" },
    ],
  };

  // Snippets genéricos aplicados às linguagens sem conjunto próprio, para que
  // o autocompletar tenha sugestões úteis em qualquer arquivo.
  const GENERIC_SNIPPETS = [
    { label: 'todo', detail: 'TODO', insertText: "${1://} TODO: $0" },
    { label: 'fixme', detail: 'FIXME', insertText: "${1://} FIXME: $0" },
    { label: 'secao', detail: 'separador de seção', insertText: "${1://} -------------------------------------\n${1://} ${2:SEÇÃO}\n${1://} -------------------------------------\n$0" },
  ];
  // ------------------------------------------------------------- estado -----
  const scriptPromises = new Map();
  let monacoApi = null;
  let bootPromise = null;
  let themeReady = false;
  let providersReady = false;
  let editor = null;
  let hostElement = null;
  let containerElement = null;
  let activeSession = null;
  let currentProjectPath = '';
  let appliedSettings = null;
  let saveTimer = null;
  const models = new Map();
  const providerLanguages = new Map();

  function loadScriptOnce(source) {
    if (scriptPromises.has(source)) return scriptPromises.get(source);
    const promise = new Promise((resolve, reject) => {
      if ([...document.scripts].some((script) => script.src && script.src.endsWith(source))) { resolve(); return; }
      const script = document.createElement('script');
      script.src = source;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Não foi possível carregar ${source}`));
      document.head.appendChild(script);
    });
    scriptPromises.set(source, promise);
    return promise;
  }

  function bootstrap() {
    if (bootPromise) return bootPromise;
    bootPromise = (async () => {
      try {
        await loadScriptOnce(`${AMD_BASE}/loader.js`);
        if (typeof window.require !== 'function' || typeof window.require.config !== 'function') throw new Error('loader AMD indisponível');
        window.require.config({ paths: { vs: AMD_BASE } });
        const monaco = await new Promise((resolve, reject) => {
          window.require(['vs/editor/editor.main'], resolve, (error) => reject(error instanceof Error ? error : new Error(String(error))));
        });
        if (!monaco || !monaco.editor) throw new Error('Monaco indisponível');
        monacoApi = monaco;
        configureLanguageServices(monaco);
        registerTheme(monaco);
        registerCompletionProviders(monaco);
        return monaco;
      } catch (error) {
        console.error('[Vuppo] Não foi possível carregar o editor Monaco:', error);
        return null;
      }
    })();
    return bootPromise;
  }

  // IntelliSense nativo: o mesmo language service que o VS Code usa para
  // JavaScript/TypeScript/JSON/CSS/HTML (membros, assinaturas, hover...).
  function configureLanguageServices(monaco) {
    const typescript = monaco.languages.typescript;
    if (typescript) {
      try {
        const compilerOptions = {
          target: typescript.ScriptTarget.ESNext,
          moduleResolution: typescript.ModuleResolutionKind.NodeJs,
          jsx: typescript.JsxEmit.React,
          lib: ['es2020', 'dom'],
          allowNonTsExtensions: true,
          allowJs: true,
          checkJs: false,
          noEmit: true,
          esModuleInterop: true,
        };
        typescript.javascriptDefaults.setCompilerOptions(compilerOptions);
        typescript.typescriptDefaults.setCompilerOptions(compilerOptions);
        typescript.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
        typescript.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
        typescript.javascriptDefaults.setEagerModelSync(true);
        typescript.typescriptDefaults.setEagerModelSync(true);
      } catch (error) {
        console.warn('[Vuppo] IntelliSense de JavaScript/TypeScript não pôde ser configurado.', error);
      }
    }
    try {
      monaco.languages.json?.jsonDefaults?.setDiagnosticsOptions({ validate: true, allowComments: true, schemas: [], enableSchemaRequest: false });
    } catch { /* opcional */ }
    try {
      monaco.languages.css?.cssDefaults?.setOptions?.({ validate: true });
      monaco.languages.css?.scssDefaults?.setOptions?.({ validate: true });
      monaco.languages.css?.lessDefaults?.setOptions?.({ validate: true });
    } catch { /* opcional */ }
    try {
      monaco.languages.html?.htmlDefaults?.setOptions?.({ format: { tabSize: 2, insertSpaces: true, wrapLineLength: 0, endWithNewline: false, unformatted: '' }, suggest: { html5: true } });
    } catch { /* opcional */ }
  }
  // Tema derivado do "Dark+" do VS Code, com o fundo escuro da Vuppo.
  function registerTheme(monaco) {
    if (themeReady) return;
    themeReady = true;
    monaco.editor.defineTheme(THEME, {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: '', foreground: 'D4D4D4' },
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'keyword.control', foreground: 'C586C0' },
        { token: 'keyword.operator', foreground: 'D4D4D4' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'string.escape', foreground: 'D7BA7D' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'regexp', foreground: 'D16969' },
        { token: 'type', foreground: '4EC9B0' },
        { token: 'type.identifier', foreground: '4EC9B0' },
        { token: 'identifier', foreground: '9CDCFE' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'constant', foreground: '4FC1FF' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'delimiter', foreground: 'D4D4D4' },
        { token: 'tag', foreground: '569CD6' },
        { token: 'attribute.name', foreground: '9CDCFE' },
        { token: 'attribute.value', foreground: 'CE9178' },
      ],
      colors: {
        'editor.background': '#141414',
        'editor.foreground': '#D4D4D4',
        'editor.lineHighlightBackground': '#1F1F1F',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#264F7844',
        'editorCursor.foreground': '#E6E6E6',
        'editorLineNumber.foreground': '#5A5A5A',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editorIndentGuide.background1': '#2A2A2A',
        'editorIndentGuide.activeBackground1': '#4A4A4A',
        'editorWhitespace.foreground': '#3A3A3A',
        'editorGutter.background': '#141414',
        'editorWidget.background': '#1E1E1E',
        'editorWidget.border': '#3C3C3C',
        'editorSuggestWidget.background': '#1E1E1E',
        'editorSuggestWidget.border': '#3C3C3C',
        'editorSuggestWidget.foreground': '#D4D4D4',
        'editorSuggestWidget.selectedBackground': '#04395E',
        'editorSuggestWidget.selectedForeground': '#FFFFFF',
        'editorSuggestWidget.highlightForeground': '#C8F169',
        'editorHoverWidget.background': '#1E1E1E',
        'editorHoverWidget.border': '#3C3C3C',
        'editorLink.activeForeground': '#C8F169',
        'minimap.background': '#141414',
        'scrollbar.shadow': '#00000000',
        'scrollbarSlider.background': '#3A3A3A66',
        'scrollbarSlider.hoverBackground': '#4A4A4A88',
        'scrollbarSlider.activeBackground': '#5A5A5AAA',
        'input.background': '#2A2A2A',
        'input.border': '#3C3C3C',
        'input.foreground': '#E6E6E6',
        'list.focusBackground': '#04395E',
        'list.hoverBackground': '#2A2D2E',
        'menu.background': '#1E1E1E',
        'menu.selectionBackground': '#04395E',
        'menu.border': '#3C3C3C',
      },
    });
  }
  // Descobre a linguagem do arquivo usando o catálogo do Monaco (90+ linguagens)
  // e, como complemento, o mapa de extensões da Vuppo.
  function detectLanguage(monaco, fileName) {
    const name = String(fileName || '').split(/[\\/]/).pop() || '';
    const lower = name.toLowerCase();
    if (FILE_NAME_LANGUAGE[lower]) return FILE_NAME_LANGUAGE[lower];
    if (monaco && typeof monaco.languages.getLanguages === 'function') {
      const languages = monaco.languages.getLanguages();
      const byName = languages.find((language) => (language.filenames || []).some((value) => String(value).toLowerCase() === lower));
      if (byName) return byName.id;
      const byExtension = languages.find((language) => (language.extensions || []).some((extension) => lower.endsWith(String(extension).toLowerCase())));
      if (byExtension) return byExtension.id;
    }
    if (lower.includes('.')) {
      const extension = lower.split('.').pop();
      if (FILE_LANGUAGE[extension]) return FILE_LANGUAGE[extension];
    }
    return FILE_LANGUAGE[lower] || 'plaintext';
  }

  // Um provider de autocompletar por linguagem: snippets + palavras-chave.
  function createCompletionProvider(monaco, keywords, snippets) {
    return {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        const seen = new Set();
        const suggestions = [];
        for (const snippet of snippets) {
          const key = `snippet:${snippet.label}`;
          if (seen.has(key)) continue;
          seen.add(key);
          suggestions.push({
            label: snippet.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: snippet.detail,
            insertText: snippet.insertText,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
            sortText: `0_${snippet.label}`,
          });
        }
        for (const keyword of keywords) {
          if (!keyword || seen.has(keyword)) continue;
          seen.add(keyword);
          suggestions.push({
            label: keyword,
            kind: monaco.languages.CompletionItemKind.Keyword,
            detail: 'palavra-chave',
            insertText: keyword,
            range,
            sortText: `1_${keyword}`,
          });
        }
        return { suggestions };
      },
    };
  }

  function registerCompletionProviders(monaco) {
    if (providersReady) return;
    providersReady = true;
    for (const language of monaco.languages.getLanguages()) {
      const nativeService = NATIVE_INTELLISENSE.has(language.id);
      const keywords = nativeService ? [] : (KEYWORDS[language.id] || []);
      const snippets = SNIPPETS[language.id] || (nativeService ? [] : GENERIC_SNIPPETS);
      if (!keywords.length && !snippets.length) continue;
      providerLanguages.set(language.id, { keywords: keywords.length, snippets: snippets.length, provider: createCompletionProvider(monaco, keywords, snippets) });
      monaco.languages.registerCompletionItemProvider(language.id, providerLanguages.get(language.id).provider);
    }
  }
  // Opções do Monaco derivadas das Configurações da Vuppo.
  function editorOptions(settings) {
    const source = settings || {};
    const fontSize = Number(source.editorFontSize) || 12;
    const tabSize = Number(source.editorTabSize) || 2;
    const minimapWidth = Number(source.editorMinimapWidth) || 120;
    return {
      theme: THEME,
      fontFamily: "'DM Mono', Consolas, 'Courier New', monospace",
      fontSize,
      tabSize,
      lineNumbers: source.editorLineNumbers === false ? 'off' : 'on',
      lineNumbersMinChars: 3,
      wordWrap: source.editorWordWrap === false ? 'off' : 'on',
      wrappingIndent: 'same',
      minimap: {
        enabled: source.editorMinimap !== false,
        size: 'proportional',
        showSlider: 'mouseover',
        renderCharacters: false,
        maxColumn: Math.max(60, Math.round(minimapWidth * 1.4)),
        side: 'right',
      },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      renderLineHighlight: 'all',
      renderWhitespace: 'selection',
      cursorBlinking: 'blink',
      cursorSmoothCaretAnimation: 'on',
      mouseWheelZoom: true,
      contextmenu: true,
      glyphMargin: false,
      folding: true,
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true, highlightActiveIndentation: true },
      autoClosingBrackets: 'languageDefined',
      autoClosingQuotes: 'languageDefined',
      autoIndent: 'full',
      formatOnPaste: true,
      formatOnType: true,
      tabCompletion: 'on',
      suggestOnTriggerCharacters: true,
      quickSuggestions: { other: true, comments: false, strings: false },
      quickSuggestionsDelay: 60,
      wordBasedSuggestions: 'allDocuments',
      snippetSuggestions: 'top',
      parameterHints: { enabled: true, cycle: true },
      hover: { enabled: true, delay: 200 },
      links: true,
      colorDecorators: true,
      inlineSuggest: { enabled: true },
      stickyScroll: { enabled: false },
      unicodeHighlight: { ambiguousCharacters: false },
      suggest: { preview: true, showStatusBar: false, insertMode: 'replace', shareSuggestSelections: true },
      fixedOverflowWidgets: true,
      padding: { top: 12, bottom: 20 },
      scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false, alwaysConsumeMouseWheel: false },
      ariaLabel: 'Editor de código da Vuppo',
      automaticLayout: true,
    };
  }

  function modelKey(projectPath, file) {
    return `${projectPath}::${file}`;
  }

  function modelUri(monaco, projectPath, file) {
    const encode = (value) => value.split('/').filter(Boolean).map(encodeURIComponent).join('/');
    const project = encode(String(projectPath || 'externo').replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1'));
    const target = encode(String(file).replace(/\\/g, '/'));
    return monaco.Uri.parse(`file:///vuppo/${project ? `${project}/` : ''}${target}`);
  }

  function applySettings(settings) {
    appliedSettings = settings || appliedSettings;
    if (!editor) return;
    editor.updateOptions(editorOptions(appliedSettings));
    editor.layout();
  }

  function revealLine(line) {
    if (!editor) return;
    const lineNumber = Math.max(1, Number(line) || 1);
    editor.revealLineInCenterIfOutsideViewport(lineNumber);
    editor.setPosition({ lineNumber, column: 1 });
  }
  function bindEditorEvents(monaco) {
    editor.addAction({
      id: 'vuppo.saveFile',
      label: 'Salvar arquivo',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1,
      run: () => { void save(); },
    });
    editor.onDidChangeModelContent(() => {
      if (!activeSession) return;
      activeSession.onChange?.(editor.getValue());
      scheduleAutoSave();
    });
  }

  function scheduleAutoSave() {
    clearTimeout(saveTimer);
    const settings = appliedSettings || {};
    if (settings.autoSave !== 'afterDelay') return;
    saveTimer = setTimeout(() => { void save(); }, Number(settings.autoSaveDelay) || 1000);
  }

  function flashSaved() {
    if (!hostElement) return;
    hostElement.classList.add('saved');
    setTimeout(() => hostElement?.classList.remove('saved'), 700);
  }

  // Abre (ou reutiliza) o editor Monaco dentro do container informado.
  // config: { file, value, language, line, projectPath, settings, readOnly,
  //           onChange(value), onSave(value), onSaveError(error), fallback() }
  async function open(container, config) {
    const options = config || {};
    const fallback = typeof options.fallback === 'function' ? options.fallback : null;
    if (!container) { if (fallback) fallback(); return; }
    const monaco = await bootstrap();
    if (!monaco || !document.body.contains(container)) { if (fallback) fallback(); return; }
    const projectPath = String(options.projectPath || '');
    try {
      if (containerElement && containerElement !== container) disposeAll();
      if (!editor || containerElement !== container) {
        container.classList.add('monaco-active');
        container.innerHTML = '<div class="vuppo-monaco" role="application" aria-label="Editor de código da Vuppo" spellcheck="false"></div>';
        hostElement = container.querySelector('.vuppo-monaco');
        containerElement = container;
        currentProjectPath = projectPath;
        appliedSettings = options.settings || null;
        editor = monaco.editor.create(hostElement, { ...editorOptions(appliedSettings), value: '', language: 'plaintext' });
        bindEditorEvents(monaco);
      } else {
        container.classList.add('monaco-active');
        currentProjectPath = projectPath;
        if (appliedSettings !== options.settings) applySettings(options.settings);
      }
      const file = String(options.file || 'arquivo');
      const key = modelKey(projectPath, file);
      const language = options.language || detectLanguage(monaco, file);
      const uri = modelUri(monaco, projectPath, file);
      let model = models.get(key);
      if (!model) {
        model = monaco.editor.getModel(uri) || monaco.editor.createModel(String(options.value ?? ''), language, uri);
        models.set(key, model);
      } else if (model.getLanguageId() !== language) {
        monaco.editor.setModelLanguage(model, language);
      }
      activeSession = { key, file, model, uri, onChange: options.onChange, onSave: options.onSave, onSaveError: options.onSaveError };
      editor.setModel(model);
      editor.updateOptions({ readOnly: Boolean(options.readOnly) });
      editor.focus();
      if (options.line) revealLine(options.line);
      else editor.setPosition({ lineNumber: 1, column: 1 });
    } catch (error) {
      console.error('[Vuppo] Falha ao abrir o editor Monaco:', error);
      disposeAll();
      if (fallback) fallback();
    }
  }

  async function save() {
    clearTimeout(saveTimer);
    if (!editor || !activeSession || typeof activeSession.onSave !== 'function') return false;
    try {
      await activeSession.onSave(editor.getValue());
      flashSaved();
      return true;
    } catch (error) {
      if (typeof activeSession.onSaveError === 'function') activeSession.onSaveError(error);
      else alert(error?.message || 'Não foi possível salvar o arquivo.');
      return false;
    }
  }
  function close(file) {
    const key = modelKey(currentProjectPath, file);
    const model = models.get(key);
    if (!model) return;
    if (activeSession && activeSession.key === key) {
      activeSession = null;
      editor?.setModel(null);
    }
    models.delete(key);
    try { model.dispose(); } catch { /* já descartado */ }
  }

  function disposeAll() {
    clearTimeout(saveTimer);
    activeSession = null;
    if (editor) { try { editor.dispose(); } catch { /* já descartado */ } }
    editor = null;
    hostElement = null;
    models.forEach((model) => { try { model.dispose(); } catch { /* já descartado */ } });
    models.clear();
    if (containerElement) containerElement.classList.remove('monaco-active');
    containerElement = null;
    currentProjectPath = '';
    appliedSettings = null;
  }

  // Amostra do autocompletar da linguagem ativa (usado em testes/diagnóstico).
  function completionSample(languageId) {
    const id = languageId || activeSession?.model?.getLanguageId?.();
    const entry = providerLanguages.get(id);
    const model = activeSession?.model;
    if (!entry || !entry.provider || !model) return { language: id || null, labels: [] };
    const lastLine = model.getLineCount();
    const position = { lineNumber: lastLine, column: model.getLineMaxColumn(lastLine) };
    const result = entry.provider.provideCompletionItems(model, position) || {};
    return { language: id, labels: (result.suggestions || []).slice(0, 10).map((item) => item.label) };
  }

  function diagnostics() {
    return {
      ready: Boolean(monacoApi),
      languageCount: monacoApi ? monacoApi.languages.getLanguages().length : 0,
      completionLanguages: [...providerLanguages.keys()],
      keywordLanguages: Object.keys(KEYWORDS).length,
      snippetLanguages: Object.keys(SNIPPETS).length,
      open: Boolean(editor && activeSession),
      file: activeSession?.file || null,
      language: activeSession?.model?.getLanguageId?.() || null,
      valueLength: activeSession?.model?.getValue?.().length || 0,
    };
  }

  window.VuppoEditor = {
    whenReady: bootstrap,
    isReady: () => Boolean(monacoApi),
    isOpen: () => Boolean(editor && activeSession),
    activeFile: () => activeSession?.file || null,
    languageFor: (fileName) => detectLanguage(monacoApi, fileName),
    open,
    close,
    disposeAll,
    save,
    getValue: () => (editor ? editor.getValue() : ''),
    setValue: (value) => { if (editor) editor.setValue(String(value ?? '')); },
    focus: () => editor?.focus(),
    layout: () => editor?.layout(),
    revealLine,
    applySettings,
    completionSample,
    __diagnostics: diagnostics,
  };

  // Pré-carrega o Monaco logo depois que a interface abre: assim o primeiro
  // arquivo já aparece colorido, sem espera perceptível.
  const warmUp = () => setTimeout(() => { void bootstrap(); }, 600);
  if (document.readyState === 'complete') warmUp();
  else window.addEventListener('load', warmUp, { once: true });
})();



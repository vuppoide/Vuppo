const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'qwen/qwen3.8-27b:free';
// O modelo principal tem um Ãºnico provedor e costuma retornar 429; a OpenRouter
// faz failover automÃ¡tico para os prÃ³ximos da lista quando isso acontece.
// A OpenRouter aceita no mÃ¡ximo 3 itens no array `models`.
const DEFAULT_FALLBACKS = [
  'nvidia/nemotron-3-ultra-550b-a55b:free',
  'cohere/north-mini-code:free'
];
const MAX_MESSAGES = 40;
const MAX_CONTENT_LENGTH = 20000;
const REQUEST_TIMEOUT_MS = 60000;
const ALLOWED_ROLES = new Set(['user', 'assistant', 'system', 'tool']);

const SYSTEM_PROMPT = [
  'Voce e o assistente de IA oficial da VUPPO, um editor e auditor de seguranca de codigo.',
  'Responda sempre em portugues (pt-BR), de forma clara, objetiva e educada.',
  'Voce tem acesso a ferramentas para interagir com o projeto aberto do usuario:',
  'ler_arquivo, listar_pasta, buscar_no_codigo e auditar_arquivo (executam na hora);',
  'editar_arquivo e executar_comando (exigem aprovacao do usuario - voce so chama a ferramenta,',
  'o sistema pede a confirmacao e devolve o resultado para voce continuar).',
  'REGRAS DE AGENTE:',
  '1. Quando o usuario pedir algo sobre o projeto (explicar, corrigir, criar, auditar, rodar testes),',
  'USE AS FERRAMENTAS em vez de pedir que ele cole codigo. Comece explorando (listar_pasta, ler_arquivo).',
  '2. Antes de chamar editar_arquivo, SEMPRE leia o arquivo atual com ler_arquivo (se existir).',
  '3. Ao chamar editar_arquivo ou executar_comando, explique em 1 frase o que vai fazer e por que.',
  '4. Nunca invente conteudo de arquivos: leia primeiro. Se nao houver projeto aberto, avise e peca para abrir.',
  '5. Formate respostas com markdown: titulos, listas, `codigo inline` e blocos ```linguagem para codigo.',
  '6. Para seguranca: explique o risco da vulnerabilidade e mostre como corrigir com exemplo de codigo.',
  'Se nao souber alguma coisa, diga honestamente em vez de inventar informacoes.'
].join(' ');

const MAX_AGENT_STEPS = 8;
const APPROVAL_TTL_MS = 10 * 60 * 1000; // 10 minutos
const TOOL_RESULT_LIMIT = 6000;

function fail(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function normalizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    throw fail('Envie o histÃ³rico de mensagens no campo "messages".', 400);
  }
  if (rawMessages.length > MAX_MESSAGES) {
    throw fail(`Envie no mÃ¡ximo ${MAX_MESSAGES} mensagens por requisiÃ§Ã£o.`, 400);
  }

  return rawMessages.map((item) => {
    if (!item || !ALLOWED_ROLES.has(item.role)) {
      throw fail('Cada mensagem precisa ter role "user", "assistant", "system" ou "tool".', 400);
    }
    const content = typeof item.content === 'string' ? item.content.trim() : '';
    if (!content) {
      throw fail('Cada mensagem precisa ter conteÃºdo nÃ£o vazio.', 400);
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      throw fail(`Mensagem muito longa (mÃ¡ximo de ${MAX_CONTENT_LENGTH} caracteres).`, 400);
    }
    return { role: item.role, content };
  });
}

function resolveModels() {
  const primary = process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
  const configured = process.env.OPENROUTER_MODEL_FALLBACKS;
  const fallbacks = (typeof configured === 'string'
    ? configured.split(',').map((item) => item.trim()).filter(Boolean)
    : DEFAULT_FALLBACKS
  ).filter((id) => id !== primary);
  return [primary, ...fallbacks].slice(0, 3); // limite da OpenRouter: 3 modelos
}

async function requestCompletion(apiKey, modelIds, messages, signal, tools) {
  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Title': 'VUPPO'
    },
    body: JSON.stringify({
      // `models` (em vez de `model`) habilita o failover automÃ¡tico da OpenRouter
      // entre os modelos quando um deles retorna rate limit ou indisponibilidade.
      ...(modelIds.length > 1 ? { models: modelIds } : { model: modelIds[0] }),
      messages,
      ...(tools && tools.length ? { tools, tool_choice: 'auto' } : {}),
      max_tokens: tools && tools.length ? 4096 : 2048
    }),
    signal
  });

  const payload = await response.json().catch(() => null);
  return { response, payload };
}

const { agentTools } = require('./agentTools');

function resolveApiKey() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw fail('Chave da OpenRouter nao configurada (OPENROUTER_API_KEY no .env).', 500);
  return apiKey;
}

function extractReply(payload) {
  const content = payload && payload.choices && payload.choices[0] && payload.choices[0].message
    ? payload.choices[0].message.content : '';
  if (Array.isArray(content)) {
    return content.filter((p) => p && p.type === 'text' && p.text).map((p) => p.text).join('');
  }
  return typeof content === 'string' ? content : '';
}

function parseToolCalls(payload) {
  const msg = payload && payload.choices && payload.choices[0] ? payload.choices[0].message : null;
  const calls = msg && Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
  return calls
    .filter((c) => c && c.type === 'function' && c.function && c.function.name)
    .map((c) => {
      let args = {};
      try { args = JSON.parse(c.function.arguments || '{}'); } catch (e) { args = {}; }
      return { id: c.id || ('call_' + Date.now()), name: c.function.name, args };
    });
}

async function completeWithRetry(apiKey, modelIds, messages, tools) {
  let lastError = null;
  const MAX_ATTEMPTS = 3;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const req = await requestCompletion(apiKey, modelIds, messages, controller.signal, tools);
      const apiError = req.payload && req.payload.error;
      if (req.response.ok && !apiError) return { payload: req.payload, model: req.payload.model || modelIds[0] };
      if (apiError) {
        const code = Number(apiError.code) || (req.response.ok ? 502 : req.response.status);
        if (code === 429 || code === 503) {
          lastError = fail('A IA esta sobrecarregada (rate limit). Tente novamente em instantes.', 503);
        } else {
          throw fail('Falha na OpenRouter: ' + (apiError.message || 'erro desconhecido'), 502);
        }
      } else if (req.response.status === 429) {
        lastError = fail('A IA esta sobrecarregada (rate limit). Tente novamente em instantes.', 503);
      } else {
        throw fail('Falha na OpenRouter: ' + ((req.payload && req.payload.message) || ('HTTP ' + req.response.status)), 502);
      }
    } catch (err) {
      if (err && err.name === 'AbortError') throw fail('A IA demorou demais. Tente novamente.', 504);
      if (err && err.status) throw err;
      lastError = fail('Nao foi possivel conectar a OpenRouter.', 502);
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < MAX_ATTEMPTS - 1) await new Promise((r) => setTimeout(r, 2000));
  }
  throw lastError || fail('Nao foi possivel obter resposta da IA.', 502);
}

function summarize(text) {
  const s = String(text == null ? '' : text);
  return s.length > TOOL_RESULT_LIMIT ? s.slice(0, TOOL_RESULT_LIMIT) + '\n...[truncado]' : s;
}

const pendingActions = new Map();

function pendingGet(id) {
  const entry = pendingActions.get(id);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > APPROVAL_TTL_MS) { pendingActions.delete(id); return null; }
  return entry;
}


async function runReadOnlyLoop(apiKey, modelIds, messages, projectDir, steps) {
  for (let i = 0; i < MAX_AGENT_STEPS; i += 1) {
    const turn = await completeWithRetry(apiKey, modelIds, messages, agentTools.tools);
    const calls = parseToolCalls(turn.payload);
    const draft = extractReply(turn.payload).trim();
    if (!calls.length) {
      return { text: draft, model: turn.model, done: true, steps };
    }
    messages.push({
      role: 'assistant',
      content: draft == null || draft === '' ? ' ' : draft,
      tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } }))
    });
    for (const call of calls) {
      if (agentTools.requiresApproval(call.name)) {
        const actionId = 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        pendingActions.set(actionId, {
          name: call.name, args: call.args, messages, modelIds, projectDir,
          draft: draft || '', steps, createdAt: Date.now()
        });
        return {
          text: draft, model: turn.model, done: true,
          steps,
          pendingApproval: {
            actionId, tool: call.name,
            description: agentTools.describeCall(call.name, call.args),
            args: call.args
          }
        };
      }
      let result = '';
      try {
        result = await agentTools.execute(call.name, call.args, projectDir);
      } catch (err) {
        result = 'ERRO: ' + (err.message || 'falha na ferramenta');
      }
      steps.push({ tool: call.name, args: call.args });
      messages.push({ role: 'tool', tool_call_id: call.id, content: summarize(result) });
    }
  }
  const rlClosing = await completeWithRetry(apiKey, modelIds, messages.concat([
    { role: 'user', content: 'Resuma agora o que voce fez ate aqui para o usuario em portugues.' }
  ]));
  return { text: extractReply(rlClosing.payload).trim(), model: rlClosing.model, done: true, steps };
}

async function finishFromMessages(apiKey, modelIds, messages, projectDir, steps) {
  for (let i = 0; i < MAX_AGENT_STEPS; i += 1) {
    const turn = await completeWithRetry(apiKey, modelIds, messages, agentTools.tools);
    const calls = parseToolCalls(turn.payload);
    const draft = extractReply(turn.payload).trim();
    if (!calls.length) {
      return { text: draft, model: turn.model, steps };
    }
    messages.push({
      role: 'assistant',
      content: draft || null,
      tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } }))
    });
    for (const call of calls) {
      if (agentTools.requiresApproval(call.name)) {
        const actionId = 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        pendingActions.set(actionId, {
          name: call.name, args: call.args, messages, modelIds, projectDir,
          draft: draft || '', steps, createdAt: Date.now()
        });
        return {
          text: draft, model: turn.model, steps,
          pendingApproval: {
            actionId, tool: call.name,
            description: agentTools.describeCall(call.name, call.args),
            args: call.args
          }
        };
      }
      let result = '';
      try {
        result = await agentTools.execute(call.name, call.args, projectDir);
      } catch (err) {
        result = 'ERRO: ' + (err.message || 'falha na ferramenta');
      }
      steps.push({ tool: call.name, args: call.args });
      messages.push({ role: 'tool', tool_call_id: call.id, content: summarize(result) });
    }
  }
  const closing = await completeWithRetry(apiKey, modelIds, messages.concat([
    { role: 'user', content: 'Conclua agora com um resumo em portugues do que foi feito.' }
  ]));
  return { text: extractReply(closing.payload).trim(), model: closing.model, steps };
}

const agentService = {
  async agentChat(rawMessages, projectDir) {
    const apiKey = resolveApiKey();
    const modelIds = resolveModels();
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...normalizeMessages(rawMessages || [])];
    const outcome = await runReadOnlyLoop(apiKey, modelIds, messages, projectDir || '', []);
    if (!outcome.text) throw fail('A IA retornou uma resposta vazia. Tente novamente.', 503);
    const base = { reply: outcome.text, model: outcome.model, steps: outcome.steps };
    if (outcome.pendingApproval) base.pendingApproval = outcome.pendingApproval;
    return base;
  },

  async resolveAction(actionId, approved) {
    const pending = pendingGet(actionId);
    if (!pending) throw fail('Aprovacao expirada ou invalida. Envie a mensagem novamente.', 404);
    pendingActions.delete(actionId);
    const apiKey = resolveApiKey();
    if (!approved) {
      pending.messages.push({ role: 'user', content: 'O usuario RECUSOU a acao "' + pending.name + '". Continue sem executa-la.' });
      const fin = await finishFromMessages(apiKey, pending.modelIds, pending.messages, pending.projectDir, pending.steps);
      return { reply: fin.text, model: fin.model, steps: fin.steps, actionResult: 'recusada' };
    }
    let result = '';
    try {
      result = await agentTools.execute(pending.name, pending.args, pending.projectDir);
    } catch (err) {
      result = 'ERRO: ' + (err.message || 'falha na ferramenta');
    }
    pending.steps.push({ tool: pending.name, args: pending.args });
    pending.messages.push({
      role: 'assistant',
      content: pending.draft || null,
      tool_calls: [{ id: actionId, type: 'function', function: { name: pending.name, arguments: JSON.stringify(pending.args) } }]
    });
    pending.messages.push({ role: 'tool', tool_call_id: actionId, content: summarize(result) });
    const fin = await finishFromMessages(apiKey, pending.modelIds, pending.messages, pending.projectDir, pending.steps);
    return { reply: fin.text, model: fin.model, steps: fin.steps, actionResult: 'executada' };
  }
};


const chatService = {
  async chat(rawMessages) {
    const apiKey = resolveApiKey();
    const modelIds = resolveModels();
    const messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...normalizeMessages(rawMessages)];
    const turn = await completeWithRetry(apiKey, modelIds, messages);
    const reply = extractReply(turn.payload).trim();
    if (!reply) throw fail('A IA retornou uma resposta vazia. Tente novamente.', 503);
    return { reply, model: turn.model };
  },
  normalizeMessages
};

module.exports = { chatService, agentService, SYSTEM_PROMPT, DEFAULT_MODEL };


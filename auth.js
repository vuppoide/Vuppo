const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Planos da VUPPO: cada plano define quantos créditos o usuário pode consumir por ciclo.
const PLANS = {
  free: { id: 'free', name: 'Free', label: 'Free Plan', price: 0, monthlyCredits: 500, description: 'Para começar' },
  pro: { id: 'pro', name: 'Pro', label: 'Pro Plan', price: 12, monthlyCredits: 5000, description: 'Para projetos em crescimento' },
  team: { id: 'team', name: 'Team', label: 'Team Plan', price: 29, monthlyCredits: 20000, description: 'Para equipes de segurança' },
};
const DEFAULT_PLAN = 'free';
const CREDIT_HISTORY_LIMIT = 20;
const CYCLE_FORMATTER = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function createAuthStore(userDataPath) {
  const filePath = path.join(userDataPath, 'accounts.json');
  const emptyStore = { accounts: [], session: null };
  const pendingCodes = new Map();

  function readStore() {
    try {
      return { ...emptyStore, ...JSON.parse(fs.readFileSync(filePath, 'utf8')) };
    } catch {
      return { ...emptyStore };
    }
  }

  function writeStore(store) {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), { mode: 0o600 });
  }

  function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
  }

  function safeEqual(left, right) {
    const a = Buffer.from(left, 'hex');
    const b = Buffer.from(right, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  function publicAccount(account) {
    return {
      id: account.id,
      name: account.name,
      email: account.email,
      provider: account.provider,
      plan: normalizePlanId(account.plan),
      planLabel: PLANS[normalizePlanId(account.plan)].label,
      github: githubInfo(account),
    };
  }

  function currentCycle(date = new Date()) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  function cycleDate(cycle) {
    const [year, month] = String(cycle || currentCycle()).split('-').map(Number);
    const now = new Date();
    return new Date(Date.UTC(Number.isFinite(year) ? year : now.getUTCFullYear(), (Number.isFinite(month) ? month : 1) - 1, 1));
  }

  function cycleLabel(cycle) {
    return CYCLE_FORMATTER.format(cycleDate(cycle));
  }

  function cycleRenewal(cycle) {
    const start = cycleDate(cycle);
    return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString();
  }

  function normalizePlanId(planId) {
    return PLANS[planId] ? planId : DEFAULT_PLAN;
  }

  // Créditos são reiniciados automaticamente quando o ciclo (mês) muda.
  function normalizeCredits(account, date = new Date()) {
    const stored = account && typeof account.credits === 'object' && account.credits ? account.credits : {};
    const cycle = currentCycle(date);
    const sameCycle = stored.cycle === cycle;
    return {
      cycle,
      used: sameCycle ? Math.max(0, Number(stored.used) || 0) : 0,
      history: sameCycle && Array.isArray(stored.history) ? stored.history.slice(0, CREDIT_HISTORY_LIMIT) : [],
    };
  }

  function planCatalog() {
    return Object.values(PLANS).map((plan) => ({ id: plan.id, name: plan.name, label: plan.label, price: plan.price, credits: plan.monthlyCredits, description: plan.description }));
  }

  function usageSnapshot(account, date = new Date()) {
    const plan = PLANS[normalizePlanId(account && account.plan)];
    const credits = normalizeCredits(account, date);
    return {
      signedIn: Boolean(account),
      plan: plan.id,
      planName: plan.name,
      planLabel: plan.label,
      planPrice: plan.price,
      planDescription: plan.description,
      limit: plan.monthlyCredits,
      used: credits.used,
      remaining: Math.max(0, plan.monthlyCredits - credits.used),
      overage: Math.max(0, credits.used - plan.monthlyCredits),
      percent: plan.monthlyCredits ? Math.min(100, Math.round((credits.used / plan.monthlyCredits) * 1000) / 10) : 0,
      cycle: credits.cycle,
      cycleLabel: cycleLabel(credits.cycle),
      renewsAt: cycleRenewal(credits.cycle),
      lastActivityAt: credits.history.length ? credits.history[0].at : null,
      history: credits.history,
      plans: planCatalog(),
    };
  }

  function githubInfo(account) {
    const github = account && account.github;
    if (!github || !github.login) return null;
    return { login: github.login, avatarUrl: github.avatarUrl || '', source: github.source || 'oauth', connectedAt: github.connectedAt || null };
  }

  function sessionAccount(store) {
    return store.accounts.find((item) => item.id === store.session) || null;
  }

  function disconnectGithubShape() {
    return { connected: false, login: '', avatarUrl: '', source: null, connectedAt: null };
  }

  function validateCredentials(email, password) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Digite um e-mail válido.');
    if (!password || password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  }

  return {
    getSession() {
      const store = readStore();
      const account = sessionAccount(store);
      return account ? publicAccount(account) : null;
    },
    getUsage() {
      const store = readStore();
      return usageSnapshot(sessionAccount(store));
    },
    setPlan(planId) {
      const store = readStore();
      const account = sessionAccount(store);
      if (!account) throw new Error('Entre na sua conta Vuppo para trocar de plano.');
      if (!PLANS[planId]) throw new Error('Plano inválido.');
      account.plan = planId;
      account.credits = normalizeCredits(account);
      writeStore(store);
      return usageSnapshot(account);
    },
    recordUsage({ credits, label, filesScanned } = {}) {
      const store = readStore();
      const account = sessionAccount(store);
      if (!account) return null;
      const now = new Date();
      const current = normalizeCredits(account, now);
      const cost = Math.max(0, Math.round(Number(credits) || 0));
      const entry = { label: String(label || 'Análise de projeto').slice(0, 140), credits: cost, files: Math.max(0, Math.round(Number(filesScanned) || 0)), at: now.toISOString() };
      account.plan = normalizePlanId(account.plan);
      account.credits = { cycle: current.cycle, used: current.used + cost, history: [entry, ...current.history].slice(0, CREDIT_HISTORY_LIMIT) };
      writeStore(store);
      return usageSnapshot(account, now);
    },
    getGithub() {
      const store = readStore();
      const info = githubInfo(sessionAccount(store));
      return info ? { connected: true, ...info } : disconnectGithubShape();
    },
    connectGithub({ login, avatarUrl, source, token } = {}) {
      const store = readStore();
      const account = sessionAccount(store);
      if (!account) throw new Error('Entre na sua conta Vuppo para conectar o GitHub.');
      if (!login) throw new Error('O GitHub não retornou um usuário válido.');
      account.github = {
        login: String(login),
        avatarUrl: String(avatarUrl || ''),
        source: source === 'cli' ? 'cli' : 'oauth',
        connectedAt: new Date().toISOString(),
        ...(token ? { token: String(token) } : {}),
      };
      writeStore(store);
      return { connected: true, ...githubInfo(account) };
    },
    disconnectGithub() {
      const store = readStore();
      const account = sessionAccount(store);
      if (!account) throw new Error('Entre na sua conta Vuppo para desconectar o GitHub.');
      delete account.github;
      writeStore(store);
      return disconnectGithubShape();
    },
    signup({ name, email, password }) {
      validateCredentials(email, password);
      if (!name || name.trim().length < 2) throw new Error('Digite seu nome.');
      const store = readStore();
      const normalizedEmail = email.trim().toLowerCase();
      if (store.accounts.some((item) => item.email === normalizedEmail)) throw new Error('Este e-mail já está cadastrado.');
      const credentials = hashPassword(password);
      const account = { id: crypto.randomUUID(), name: name.trim(), email: normalizedEmail, provider: 'email', ...credentials, createdAt: new Date().toISOString() };
      store.accounts.push(account);
      store.session = account.id;
      writeStore(store);
      return publicAccount(account);
    },
    requestSignupCode({ email }) {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Digite um e-mail válido.');
      const store = readStore();
      const normalizedEmail = email.trim().toLowerCase();
      if (store.accounts.some((item) => item.email === normalizedEmail)) throw new Error('Este e-mail já está cadastrado.');
      const code = String(crypto.randomInt(100000, 1000000));
      pendingCodes.set(normalizedEmail, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
      console.log(`[Vuppo] Código de confirmação para ${normalizedEmail}: ${code}`);
      return { email: normalizedEmail, expiresInSeconds: 600 };
    },
    verifySignupCode({ email, code }) {
      const pending = pendingCodes.get(email.trim().toLowerCase());
      if (!pending || pending.expiresAt < Date.now() || pending.code !== String(code).trim()) throw new Error('Código inválido ou expirado.');
      return { verified: true, email: email.trim().toLowerCase() };
    },
    completeSignup({ email, password, turnstileToken }) {
      const pending = pendingCodes.get(email.trim().toLowerCase());
      if (!pending || pending.expiresAt < Date.now()) throw new Error('Confirme seu e-mail novamente.');
      if (!turnstileToken) throw new Error('Confirme que você não é um robô.');
      validateCredentials(email, password);
      const store = readStore();
      const normalizedEmail = email.trim().toLowerCase();
      if (store.accounts.some((item) => item.email === normalizedEmail)) throw new Error('Este e-mail já está cadastrado.');
      const credentials = hashPassword(password);
      const account = { id: crypto.randomUUID(), name: normalizedEmail.split('@')[0], email: normalizedEmail, provider: 'email', ...credentials, createdAt: new Date().toISOString() };
      store.accounts.push(account);
      store.session = account.id;
      pendingCodes.delete(normalizedEmail);
      writeStore(store);
      return publicAccount(account);
    },
    login({ email, password }) {
      validateCredentials(email, password);
      const store = readStore();
      const account = store.accounts.find((item) => item.email === email.trim().toLowerCase());
      if (!account || !safeEqual(hashPassword(password, account.salt).hash, account.hash)) throw new Error('E-mail ou senha incorretos.');
      store.session = account.id;
      writeStore(store);
      return publicAccount(account);
    },
    socialLogin(provider) {
      if (provider !== 'Google') throw new Error(`${provider} ainda precisa ser configurado com OAuth.`);
      const store = readStore();
      const email = 'demo.google@vuppo.local';
      let account = store.accounts.find((item) => item.email === email);
      if (!account) {
        account = { id: crypto.randomUUID(), name: 'Google Demo', email, provider: 'google', createdAt: new Date().toISOString() };
        store.accounts.push(account);
      }
      store.session = account.id;
      writeStore(store);
      return publicAccount(account);
    },
    logout() {
      const store = readStore();
      store.session = null;
      writeStore(store);
    },
  };
}

module.exports = { createAuthStore, PLANS };

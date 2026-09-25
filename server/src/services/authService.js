const crypto = require('crypto');
const { readData, writeData } = require('./storageService');
const {
  PLANS,
  publicAccount,
  hashPassword,
  safeEqual,
  currentCycle,
  normalizeCredits,
  normalizePlanId,
  usageSnapshot,
  validateCredentials,
  pendingCodes,
  CREDIT_HISTORY_LIMIT,
  DEFAULT_PLAN
} = require('./authHelpers');

const authService = {
  signup({ name, email, password }) {
    validateCredentials(email, password);
    if (!name || name.trim().length < 2) throw new Error('Digite seu nome.');

    const data = readData();
    const normalizedEmail = email.trim().toLowerCase();

    if (data.accounts.some((acc) => acc.email === normalizedEmail)) {
      throw new Error('Este e-mail já está cadastrado.');
    }

    const { hash, salt } = hashPassword(password);
    const token = crypto.randomBytes(32).toString('hex');
    const newAccount = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: normalizedEmail,
      provider: 'email',
      hash,
      salt,
      plan: DEFAULT_PLAN,
      credits: { cycle: currentCycle(), used: 0, history: [] },
      tokens: [token],
      createdAt: new Date().toISOString()
    };

    data.accounts.push(newAccount);
    writeData(data);

    return {
      user: publicAccount(newAccount),
      token
    };
  },

  requestSignupCode({ email }) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Digite um e-mail válido.');
    const data = readData();
    const normalizedEmail = email.trim().toLowerCase();
    if (data.accounts.some((acc) => acc.email === normalizedEmail)) throw new Error('Este e-mail já está cadastrado.');

    const code = String(crypto.randomInt(100000, 1000000));
    pendingCodes.set(normalizedEmail, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
    console.log(`[Vuppo Backend] Código de verificação para ${normalizedEmail}: ${code}`);
    return { email: normalizedEmail, expiresInSeconds: 600, code };
  },

  verifySignupCode({ email, code }) {
    const normalized = (email || '').trim().toLowerCase();
    const pending = pendingCodes.get(normalized);
    if (!pending || pending.expiresAt < Date.now() || pending.code !== String(code).trim()) {
      throw new Error('Código inválido ou expirado.');
    }
    return { verified: true, email: normalized };
  },

  login({ email, password }) {
    validateCredentials(email, password);
    const data = readData();
    const normalizedEmail = email.trim().toLowerCase();
    const account = data.accounts.find((acc) => acc.email === normalizedEmail);

    if (!account || !account.hash || !safeEqual(hashPassword(password, account.salt).hash, account.hash)) {
      throw new Error('E-mail ou senha incorretos.');
    }

    const token = crypto.randomBytes(32).toString('hex');
    account.tokens = Array.isArray(account.tokens) ? account.tokens : [];
    account.tokens.push(token);
    writeData(data);

    return {
      user: publicAccount(account),
      token
    };
  },

  getAccountByToken(token) {
    if (!token) return null;
    const data = readData();
    const account = data.accounts.find((acc) => Array.isArray(acc.tokens) && acc.tokens.includes(token));
    return account || null;
  },

  logout(token) {
    if (!token) return false;
    const data = readData();
    const account = data.accounts.find((acc) => Array.isArray(acc.tokens) && acc.tokens.includes(token));
    if (account) {
      account.tokens = account.tokens.filter((t) => t !== token);
      writeData(data);
      return true;
    }
    return false;
  },

  getUsage(account) {
    return usageSnapshot(account);
  },

  setPlan(account, planId) {
    if (!PLANS[planId]) throw new Error('Plano inválido.');
    const data = readData();
    const target = data.accounts.find((acc) => acc.id === account.id);
    if (!target) throw new Error('Conta não encontrada.');

    target.plan = planId;
    target.credits = normalizeCredits(target);
    writeData(data);

    return usageSnapshot(target);
  },

  recordUsage(account, { credits, label, filesScanned } = {}) {
    const data = readData();
    const target = data.accounts.find((acc) => acc.id === account.id);
    if (!target) return null;

    const now = new Date();
    const current = normalizeCredits(target, now);
    const cost = Math.max(0, Math.round(Number(credits) || 0));
    const entry = {
      label: String(label || 'Análise de projeto').slice(0, 140),
      credits: cost,
      files: Math.max(0, Math.round(Number(filesScanned) || 0)),
      at: now.toISOString()
    };

    target.plan = normalizePlanId(target.plan);
    target.credits = {
      cycle: current.cycle,
      used: current.used + cost,
      history: [entry, ...current.history].slice(0, CREDIT_HISTORY_LIMIT)
    };

    writeData(data);
    return usageSnapshot(target, now);
  },

  getPlans() {
    return Object.values(PLANS);
  }
};

module.exports = {
  authService,
  publicAccount,
  PLANS
};

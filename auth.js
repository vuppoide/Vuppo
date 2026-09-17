const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

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
    return { id: account.id, name: account.name, email: account.email, provider: account.provider };
  }

  function validateCredentials(email, password) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Digite um e-mail válido.');
    if (!password || password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
  }

  return {
    getSession() {
      const store = readStore();
      const account = store.accounts.find((item) => item.id === store.session);
      return account ? publicAccount(account) : null;
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

module.exports = { createAuthStore };

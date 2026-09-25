const crypto = require('crypto');
const { readData, writeData } = require('./storageService');

const PLANS = {
  free: { id: 'free', name: 'Free', label: 'Free Plan', price: 0, monthlyCredits: 500, description: 'Para começar' },
  pro: { id: 'pro', name: 'Pro', label: 'Pro Plan', price: 12, monthlyCredits: 5000, description: 'Para projetos em crescimento' },
  team: { id: 'team', name: 'Team', label: 'Team Plan', price: 29, monthlyCredits: 20000, description: 'Para equipes de segurança' }
};

const DEFAULT_PLAN = 'free';
const CREDIT_HISTORY_LIMIT = 20;
const pendingCodes = new Map();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function currentCycle(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function cycleRenewal(cycle) {
  const [year, month] = String(cycle || currentCycle()).split('-').map(Number);
  const now = new Date();
  const start = new Date(Date.UTC(Number.isFinite(year) ? year : now.getUTCFullYear(), (Number.isFinite(month) ? month : 1) - 1, 1));
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString();
}

function normalizePlanId(planId) {
  return PLANS[planId] ? planId : DEFAULT_PLAN;
}

function normalizeCredits(account, date = new Date()) {
  const stored = account && typeof account.credits === 'object' && account.credits ? account.credits : {};
  const cycle = currentCycle(date);
  const sameCycle = stored.cycle === cycle;
  return {
    cycle,
    used: sameCycle ? Math.max(0, Number(stored.used) || 0) : 0,
    history: sameCycle && Array.isArray(stored.history) ? stored.history.slice(0, CREDIT_HISTORY_LIMIT) : []
  };
}

function publicAccount(account) {
  const plan = PLANS[normalizePlanId(account.plan)];
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    provider: account.provider || 'email',
    plan: plan.id,
    planLabel: plan.label,
    github: account.github || null
  };
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
    renewsAt: cycleRenewal(credits.cycle),
    lastActivityAt: credits.history.length ? credits.history[0].at : null,
    history: credits.history,
    plans: Object.values(PLANS)
  };
}

function validateCredentials(email, password) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Digite um e-mail válido.');
  if (!password || password.length < 8) throw new Error('A senha precisa ter pelo menos 8 caracteres.');
}

module.exports = {
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
};

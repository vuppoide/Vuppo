const { authService, publicAccount } = require('../services/authService');

const authController = {
  signup(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const result = authService.signup({ name, email, password });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  },

  requestSignupCode(req, res, next) {
    try {
      const { email } = req.body;
      const result = authService.requestSignupCode({ email });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  verifySignupCode(req, res, next) {
    try {
      const { email, code } = req.body;
      const result = authService.verifySignupCode({ email, code });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  login(req, res, next) {
    try {
      const { email, password } = req.body;
      const result = authService.login({ email, password });
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  logout(req, res, next) {
    try {
      authService.logout(req.token);
      res.json({ message: 'Logout efetuado com sucesso.' });
    } catch (err) {
      next(err);
    }
  },

  me(req, res) {
    res.json({
      user: publicAccount(req.user),
      usage: authService.getUsage(req.user)
    });
  },

  getUsage(req, res) {
    res.json(authService.getUsage(req.user));
  },

  setPlan(req, res, next) {
    try {
      const { planId } = req.body;
      const usage = authService.setPlan(req.user, planId);
      res.json({ message: `Plano atualizado para ${planId}`, usage });
    } catch (err) {
      next(err);
    }
  },

  getPlans(req, res) {
    res.json({ plans: authService.getPlans() });
  }
};

module.exports = authController;

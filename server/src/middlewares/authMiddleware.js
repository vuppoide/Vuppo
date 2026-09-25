const { authService } = require('../services/authService');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  const account = authService.getAccountByToken(token);

  if (!account) {
    return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
  }

  req.user = account;
  req.token = token;
  next();
}

function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const account = authService.getAccountByToken(token);
    if (account) {
      req.user = account;
      req.token = token;
    }
  }
  next();
}

module.exports = {
  authMiddleware,
  optionalAuthMiddleware
};

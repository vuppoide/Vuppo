function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  const status = err.status || 400;
  res.status(status).json({
    error: err.message || 'Ocorreu um erro interno no servidor.'
  });
}

module.exports = { errorHandler };

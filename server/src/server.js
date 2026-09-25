require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const scanRoutes = require('./routes/scanRoutes');
const chatRoutes = require('./routes/chatRoutes');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 4000;

// Middlewares globais
// Habilita requisições do app (file://) para a rede local (localhost) no Chromium/Electron (Private Network Access).
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  next();
});
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    name: 'VUPPO Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/chat', chatRoutes);

// Fallback 404
app.use((req, res) => {
  res.status(404).json({ error: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
});

// Middleware de tratamento de erros
app.use(errorHandler);

// Inicia o servidor se executado diretamente
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`===========================================`);
    console.log(`  🛡️ VUPPO Backend API em execução!`);
    console.log(`  📍 Endereço: http://localhost:${PORT}`);
    console.log(`  🔍 Healthcheck: http://localhost:${PORT}/api/health`);
    console.log(`===========================================`);
  });
}

module.exports = app;

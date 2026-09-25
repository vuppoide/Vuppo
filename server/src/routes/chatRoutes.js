const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

// Body: { messages: [...], projectPath: 'caminho do projeto aberto' }
router.post('/', chatController.chat);
// Body: { actionId: 'act_...', approved: true|false }
router.post('/action', chatController.action);

module.exports = router;

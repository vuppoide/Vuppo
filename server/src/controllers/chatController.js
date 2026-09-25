const { chatService, agentService } = require('../services/chatService');

const chatController = {
  async chat(req, res, next) {
    try {
      const { messages, projectPath } = req.body || {};
      const result = await agentService.agentChat(messages, projectPath || '');
      res.json(result);
    } catch (err) {
      next(err);
    }
  },

  async action(req, res, next) {
    try {
      const { actionId, approved } = req.body || {};
      if (!actionId) return res.status(400).json({ error: 'Informe o actionId.' });
      const result = await agentService.resolveAction(actionId, approved === true);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
};

module.exports = chatController;

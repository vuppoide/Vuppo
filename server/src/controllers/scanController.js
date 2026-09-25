const { scannerService } = require('../services/scannerService');

const scanController = {
  scan(req, res, next) {
    try {
      const { files, content, filename } = req.body;
      let filesToScan = [];

      if (Array.isArray(files) && files.length > 0) {
        filesToScan = files;
      } else if (content) {
        filesToScan = [{ filename: filename || 'code.js', content }];
      } else {
        return res.status(400).json({ error: 'Envie um array de arquivos ou um snippet via content.' });
      }

      const report = scannerService.scanFiles(filesToScan, req.user || null);
      res.json(report);
    } catch (err) {
      next(err);
    }
  },

  getRules(req, res) {
    res.json({ rules: scannerService.getRules() });
  },

  getHistory(req, res) {
    if (!req.user) {
      return res.status(401).json({ error: 'Autenticação necessária para consultar histórico.' });
    }
    const reports = scannerService.getReports(req.user.id);
    res.json({ reports });
  }
};

module.exports = scanController;

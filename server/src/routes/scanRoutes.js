const express = require('express');
const router = express.Router();
const scanController = require('../controllers/scanController');
const { optionalAuthMiddleware, authMiddleware } = require('../middlewares/authMiddleware');

router.post('/audit', optionalAuthMiddleware, scanController.scan);
router.get('/rules', scanController.getRules);
router.get('/history', authMiddleware, scanController.getHistory);

module.exports = router;

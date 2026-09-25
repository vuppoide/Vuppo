const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middlewares/authMiddleware');

router.post('/signup', authController.signup);
router.post('/signup/code', authController.requestSignupCode);
router.post('/signup/verify', authController.verifySignupCode);
router.post('/login', authController.login);
router.get('/plans', authController.getPlans);

router.post('/logout', authMiddleware, authController.logout);
router.get('/me', authMiddleware, authController.me);
router.get('/usage', authMiddleware, authController.getUsage);
router.post('/plan', authMiddleware, authController.setPlan);

module.exports = router;

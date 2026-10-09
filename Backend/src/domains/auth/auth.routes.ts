import { Router } from 'express';
import { AuthController } from './auth.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/google', AuthController.google);
router.get('/verify-email/confirm', AuthController.confirmEmail);
router.post('/verify-email', requireAuth, AuthController.verifyEmail);
router.post('/resend-verification', requireAuth, AuthController.resendVerification);
router.post('/logout', requireAuth, AuthController.logout);
router.get('/me', requireAuth, AuthController.me);

export default router;

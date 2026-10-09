import { Router } from 'express';
import { UsersController } from './users.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

router.get('/settings', requireAuth, UsersController.getSettings);
router.put('/settings', requireAuth, UsersController.updateSettings);

export default router;

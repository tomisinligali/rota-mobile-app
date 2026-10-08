import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// Protected dashboard endpoint
router.get('/summary', requireAuth, DashboardController.getSummary);

export default router;

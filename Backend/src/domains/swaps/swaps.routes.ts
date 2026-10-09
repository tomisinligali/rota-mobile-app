import { Router } from 'express';
import { SwapsController } from './swaps.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTeamRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createSwapSchema, rejectSwapSchema } from '../../validation/schemas';

const router = Router();

// Staff, Managers, and Owners can initiate swap or open-shift requests
router.post(
  '/teams/:teamId/request',
  requireAuth,
  requireTeamRole(['OWNER', 'MANAGER', 'STAFF']),
  validateBody(createSwapSchema),
  SwapsController.requestSwap
);

// Staff, Managers, and Owners can claim an open shift
router.post('/teams/:teamId/claim/:swapId', requireAuth, requireTeamRole(['OWNER', 'MANAGER', 'STAFF']), SwapsController.claimOpenShift);

// Managers and Owners approve swaps with atomic state verification
router.post('/teams/:teamId/approve/:swapId', requireAuth, requireTeamRole(['OWNER', 'MANAGER']), SwapsController.approveSwap);

// Managers and Owners can reject swaps
router.post(
  '/teams/:teamId/reject/:swapId',
  requireAuth,
  requireTeamRole(['OWNER', 'MANAGER']),
  validateBody(rejectSwapSchema),
  SwapsController.rejectSwap
);

// Team members can view pending and historical swaps
router.get('/teams/:teamId', requireAuth, requireTeamRole(['OWNER', 'MANAGER', 'STAFF']), SwapsController.getTeamSwaps);

export default router;

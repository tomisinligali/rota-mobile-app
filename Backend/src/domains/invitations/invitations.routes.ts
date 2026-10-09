import { Router } from 'express';
import { InvitationsController } from './invitations.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTeamRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { redisRateLimiter } from '../../middleware/rateLimit';
import { createInvitationSchema } from '../../validation/schemas';

const router = Router();

// Public / User verification and acceptance with Redis rate limiting
router.get(
  '/verify/:token',
  redisRateLimiter({ prefix: 'invite_verify', limit: 30, windowSeconds: 60 }),
  InvitationsController.verifyInvitation
);

router.post(
  '/accept/:token',
  requireAuth,
  redisRateLimiter({ prefix: 'invite_accept', limit: 10, windowSeconds: 60 }),
  InvitationsController.acceptInvitation
);

// Team invitation management with Zod validation and rate limiting
router.post(
  '/teams/:teamId',
  requireAuth,
  requireTeamRole(['OWNER', 'MANAGER']),
  redisRateLimiter({ prefix: 'invite_create', limit: 20, windowSeconds: 3600 }),
  validateBody(createInvitationSchema),
  InvitationsController.createInvitation
);
router.get('/teams/:teamId', requireAuth, requireTeamRole(['OWNER', 'MANAGER']), InvitationsController.getTeamInvitations);
router.delete('/teams/:teamId/:invitationId', requireAuth, requireTeamRole(['OWNER', 'MANAGER']), InvitationsController.revokeInvitation);

export default router;

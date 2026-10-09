import { Router } from 'express';
import { InvitationsController } from './invitations.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTeamRole } from '../../middleware/rbac';

const router = Router();

// Public / User verification and acceptance
router.get('/verify/:token', InvitationsController.verifyInvitation);
router.post('/accept/:token', requireAuth, InvitationsController.acceptInvitation);

// Team invitation management
router.post('/teams/:teamId', requireAuth, requireTeamRole(['OWNER', 'MANAGER']), InvitationsController.createInvitation);
router.get('/teams/:teamId', requireAuth, requireTeamRole(['OWNER', 'MANAGER']), InvitationsController.getTeamInvitations);
router.delete('/teams/:teamId/:invitationId', requireAuth, requireTeamRole(['OWNER', 'MANAGER']), InvitationsController.revokeInvitation);

export default router;

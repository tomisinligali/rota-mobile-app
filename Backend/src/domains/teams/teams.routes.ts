import { Router } from 'express';
import { TeamsController } from './teams.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTeamRole } from '../../middleware/rbac';

const router = Router();

// Base team routes
router.post('/', requireAuth, TeamsController.createTeam);
router.get('/', requireAuth, TeamsController.getUserTeams);

// Team specific routes (with RBAC)
router.get('/:teamId', requireAuth, requireTeamRole(['OWNER', 'MANAGER', 'STAFF']), TeamsController.getTeamDetails);
router.get('/:teamId/members', requireAuth, requireTeamRole(['OWNER', 'MANAGER', 'STAFF']), TeamsController.getTeamMembers);
router.patch('/:teamId/members/:memberId/role', requireAuth, requireTeamRole(['OWNER', 'MANAGER']), TeamsController.updateMemberRole);
router.delete('/:teamId/members/:memberId', requireAuth, requireTeamRole(['OWNER', 'MANAGER']), TeamsController.deactivateMember);

export default router;

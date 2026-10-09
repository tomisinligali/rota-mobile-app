import { Router } from 'express';
import { ShiftsController } from './shifts.controller';
import { requireAuth } from '../../middleware/auth';
import { requireTeamRole } from '../../middleware/rbac';

const router = Router();

// Shifts routes
router.post('/teams/:teamId', requireAuth, requireTeamRole(['OWNER', 'MANAGER']), ShiftsController.createShift);
router.get('/teams/:teamId', requireAuth, requireTeamRole(['OWNER', 'MANAGER', 'STAFF']), ShiftsController.getShifts);
router.patch('/teams/:teamId/:shiftId', requireAuth, requireTeamRole(['OWNER', 'MANAGER']), ShiftsController.updateShift);
router.delete('/teams/:teamId/:shiftId', requireAuth, requireTeamRole(['OWNER', 'MANAGER']), ShiftsController.cancelShift);

// Paginated activity feed
router.get('/teams/:teamId/activity', requireAuth, requireTeamRole(['OWNER', 'MANAGER', 'STAFF']), ShiftsController.getActivityFeed);

export default router;

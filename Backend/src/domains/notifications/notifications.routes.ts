import { Router } from 'express';
import { NotificationsController } from './notifications.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// Device push token registration & unregistration
router.post('/push-token', requireAuth, NotificationsController.registerPushToken);
router.delete('/push-token', requireAuth, NotificationsController.unregisterPushToken);

// Notification feed and unread counter
router.get('/', requireAuth, NotificationsController.getNotifications);

// Mark notification as read
router.patch('/:id/read', requireAuth, NotificationsController.markAsRead);
router.post('/read-all', requireAuth, NotificationsController.markAllAsRead);

export default router;

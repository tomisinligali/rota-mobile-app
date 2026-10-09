import { Router } from 'express';
import { BillingController } from './billing.controller';
import { requireAuth } from '../../middleware/auth';

const router = Router();

// Business Owner routes
router.get('/subscription/:businessId', requireAuth, BillingController.getSubscription);
router.post('/preview-proration/:businessId', requireAuth, BillingController.previewProration);
router.post('/update-subscription/:businessId', requireAuth, BillingController.updateSubscription);

// Flutterwave Webhook (at-least-once with provider_event_id deduplication)
router.post('/webhook', BillingController.handleWebhook);

export default router;

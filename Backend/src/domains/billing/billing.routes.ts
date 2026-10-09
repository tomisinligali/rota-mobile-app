import { Router } from 'express';
import { BillingController } from './billing.controller';
import { requireAuth } from '../../middleware/auth';
import { validateBody } from '../../middleware/validate';
import { redisRateLimiter } from '../../middleware/rateLimit';
import { updateSubscriptionSchema, previewProrationSchema } from '../../validation/schemas';

const router = Router();

// Business Owner routes with Redis rate limiting and Zod body validation
router.get('/subscription/:businessId', requireAuth, BillingController.getSubscription);

router.post(
  '/preview-proration/:businessId',
  requireAuth,
  redisRateLimiter({ prefix: 'billing_preview', limit: 30, windowSeconds: 60 }),
  validateBody(previewProrationSchema),
  BillingController.previewProration
);

router.post(
  '/update-subscription/:businessId',
  requireAuth,
  redisRateLimiter({ prefix: 'billing_update', limit: 15, windowSeconds: 3600 }),
  validateBody(updateSubscriptionSchema),
  BillingController.updateSubscription
);

// Flutterwave Webhook (at-least-once with provider_event_id deduplication)
router.post(
  '/webhook',
  redisRateLimiter({ prefix: 'billing_webhook', limit: 100, windowSeconds: 60 }),
  BillingController.handleWebhook
);

export default router;

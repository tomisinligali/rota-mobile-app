import { Request, Response } from 'express';
import { BillingService } from './billing.service';
import { query } from '../../db/pool';

export class BillingController {
  private static async verifyBusinessOwner(userId: string, businessId: string): Promise<boolean> {
    const res = await query(
      `SELECT tm.id 
       FROM team_memberships tm
       JOIN teams t ON t.id = tm.team_id
       WHERE tm.user_id = $1 AND t.business_id = $2 AND tm.role = 'OWNER' AND tm.status = 'ACTIVE'`,
      [userId, businessId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  static async getSubscription(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const businessId = String(req.params.businessId);

      const isOwner = await BillingController.verifyBusinessOwner(user.id, businessId);
      if (!isOwner) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Only business owners can view and manage subscription billing',
            details: {},
          },
        });
        return;
      }

      const subscription = await BillingService.getSubscription(businessId);
      res.status(200).json({
        data: subscription,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to retrieve subscription',
          details: {},
        },
      });
    }
  }

  static async previewProration(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const businessId = String(req.params.businessId);
      const { newPlanTier, newSeatCount } = req.body;

      const isOwner = await BillingController.verifyBusinessOwner(user.id, businessId);
      if (!isOwner) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Only business owners can calculate subscription proration',
            details: {},
          },
        });
        return;
      }

      const preview = await BillingService.previewProration(businessId, {
        newPlanTier,
        newSeatCount: parseInt(newSeatCount, 10),
      });

      res.status(200).json({
        data: preview,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to calculate proration preview',
          details: {},
        },
      });
    }
  }

  static async updateSubscription(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const businessId = String(req.params.businessId);
      const { newPlanTier, newSeatCount } = req.body;

      const isOwner = await BillingController.verifyBusinessOwner(user.id, businessId);
      if (!isOwner) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Only business owners can modify subscription plans and seats',
            details: {},
          },
        });
        return;
      }

      const result = await BillingService.updateSubscription(businessId, user.id, {
        newPlanTier,
        newSeatCount: parseInt(newSeatCount, 10),
      });

      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to update subscription',
          details: {},
        },
      });
    }
  }

  static async handleWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['verif-hash'] as string | undefined;
      const result = await BillingService.handleFlutterwaveWebhook(req.body, signature);

      res.status(200).json({
        status: 'success',
        result,
      });
    } catch (err: any) {
      res.status(err.status || 400).json({
        error: {
          code: err.code || 'WEBHOOK_ERROR',
          message: err.message || 'Webhook processing failed',
          details: {},
        },
      });
    }
  }
}

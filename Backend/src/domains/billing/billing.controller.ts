import { Request, Response } from 'express';
import { BillingService } from './billing.service';
import { billingWebhookQueue } from './billing.queue';
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
      const idempotencyKey =
        (req.headers['idempotency-key'] as string) ||
        (req.headers['x-idempotency-key'] as string) ||
        undefined;

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
        idempotencyKey,
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
      const secretHash = process.env.FLUTTERWAVE_SECRET_HASH || 'test-flutterwave-secret-hash';
      if (signature && signature !== secretHash) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Invalid Flutterwave webhook signature',
            details: {},
          },
        });
        return;
      }

      const payload = req.body;
      const providerEventId = String(
        payload.id || payload.data?.id || payload.event_id || `flw_${Date.now()}`
      );

      // Queue for asynchronous background processing via BullMQ
      await billingWebhookQueue.add(
        'flw-webhook',
        {
          providerEventId,
          payload,
          signature,
          receivedAt: new Date().toISOString(),
        },
        { jobId: providerEventId }
      );

      res.status(200).json({
        status: 'queued',
        providerEventId,
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

  static async initializeCheckout(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const businessId = String(req.params.businessId);
      const { planTier, billingCycle = 'monthly', seatCount, redirectUrl } = req.body;

      const isOwner = await BillingController.verifyBusinessOwner(user.id, businessId);
      if (!isOwner) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Only business owners can initiate subscription checkout',
            details: {},
          },
        });
        return;
      }

      const checkoutSession = await BillingService.initializeCheckout(businessId, user.id, {
        planTier,
        billingCycle,
        seatCount: seatCount ? parseInt(seatCount, 10) : undefined,
        redirectUrl,
      });

      res.status(200).json({
        data: checkoutSession,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to initialize checkout',
          details: {},
        },
      });
    }
  }

  static async handleRedirectCallback(req: Request, res: Response): Promise<void> {
    const { status, tx_ref, transaction_id } = req.query;

    if (status === 'cancelled' || !transaction_id) {
      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rota - Payment Cancelled</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; color: #1C1B1F; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #FFFFFF; border-radius: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 440px; width: 100%; padding: 36px 24px; text-align: center; }
            .icon-circle { width: 68px; height: 68px; border-radius: 50%; background: #FFDAD6; color: #BA1A1A; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; font-weight: bold; }
            h1 { font-size: 22px; font-weight: 700; margin: 0 0 10px; color: #1C1B1F; }
            p { font-size: 15px; color: #49454F; line-height: 1.5; margin: 0 0 24px; }
            .btn { display: block; width: 100%; background: #6600CC; color: #FFFFFF; text-decoration: none; padding: 15px 20px; border-radius: 9999px; font-weight: 700; font-size: 16px; box-sizing: border-box; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon-circle">✕</div>
            <h1>Payment Cancelled</h1>
            <p>Your payment was not completed and your card was not charged. You can return to the Rota app anytime to try again.</p>
            <a href="rota://" class="btn">Return to Rota App</a>
          </div>
        </body>
        </html>
      `);
      return;
    }

    try {
      const processResult = await BillingService.verifyAndProcessTransaction(
        String(transaction_id),
        tx_ref ? String(tx_ref) : undefined
      );

      if (!processResult.success) {
        res.status(400).send(`
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Rota - Verification Failed</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; color: #1C1B1F; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
              .card { background: #FFFFFF; border-radius: 20px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); max-width: 440px; width: 100%; padding: 36px 24px; text-align: center; }
              .icon-circle { width: 68px; height: 68px; border-radius: 50%; background: #FFDAD6; color: #BA1A1A; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; font-weight: bold; }
              h1 { font-size: 22px; font-weight: 700; margin: 0 0 10px; color: #1C1B1F; }
              p { font-size: 15px; color: #49454F; line-height: 1.5; margin: 0 0 24px; }
              .btn { display: block; width: 100%; background: #6600CC; color: #FFFFFF; text-decoration: none; padding: 15px 20px; border-radius: 9999px; font-weight: 700; font-size: 16px; box-sizing: border-box; }
            </style>
          </head>
          <body>
            <div class="card">
              <div class="icon-circle">!</div>
              <h1>Verification Failed</h1>
              <p>${processResult.message}</p>
              <a href="rota://" class="btn">Return to Rota App</a>
            </div>
          </body>
          </html>
        `);
        return;
      }

      res.status(200).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rota - Payment Confirmed!</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; color: #1C1B1F; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: #FFFFFF; border-radius: 24px; box-shadow: 0 8px 30px rgba(0,0,0,0.08); max-width: 460px; width: 100%; padding: 40px 28px; text-align: center; }
            .icon-circle { width: 72px; height: 72px; border-radius: 50%; background: #CEFDDE; color: #059435; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 34px; font-weight: bold; }
            h1 { font-size: 24px; font-weight: 700; margin: 0 0 8px; color: #1C1B1F; }
            .subtitle { font-size: 15px; color: #49454F; line-height: 1.5; margin: 0 0 24px; }
            .details-box { background: #F3EDF7; border-radius: 14px; padding: 18px 20px; margin-bottom: 28px; text-align: left; }
            .row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid #E6E0E9; font-size: 14px; }
            .row:last-child { border-bottom: none; }
            .label { color: #49454F; }
            .value { font-weight: 600; color: #1C1B1F; }
            .badge { background: #6600CC; color: white; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
            .btn { display: block; width: 100%; background: #6600CC; color: #FFFFFF; text-decoration: none; padding: 16px 20px; border-radius: 9999px; font-weight: 700; font-size: 16px; box-sizing: border-box; }
            .note { font-size: 12px; color: #79747E; margin-top: 16px; line-height: 1.4; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon-circle">✓</div>
            <h1>Payment Confirmed!</h1>
            <p class="subtitle">Your Rota workspace has been upgraded. You now have full access to your new tier and staff capacity.</p>
            <div class="details-box">
              <div class="row">
                <span class="label">Upgraded Plan</span>
                <span class="badge">${processResult.planTier} PLAN</span>
              </div>
              <div class="row">
                <span class="label">Staff Capacity</span>
                <span class="value">${processResult.seatCount} Staff Seats</span>
              </div>
              <div class="row">
                <span class="label">Billing Cycle</span>
                <span class="value">${processResult.billingCycle?.toUpperCase()}</span>
              </div>
              <div class="row">
                <span class="label">Amount Paid</span>
                <span class="value">$${processResult.amount} ${processResult.currency}</span>
              </div>
            </div>
            <a href="rota://" class="btn">Open Rota App</a>
            <p class="note">If the app does not open automatically, switch back to your Rota app now to see your updated dashboard.</p>
          </div>
        </body>
        </html>
      `);
    } catch (err: any) {
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Rota - Error</title>
        </head>
        <body style="font-family: -apple-system, sans-serif; text-align: center; padding: 40px;">
          <h2>An error occurred</h2>
          <p>${err.message || 'Unable to process transaction.'}</p>
          <a href="rota://" style="display:inline-block; padding:12px 24px; background:#6600CC; color:#fff; text-decoration:none; border-radius:999px;">Return to App</a>
        </body>
        </html>
      `);
    }
  }
}

import { Request, Response } from 'express';
import { SwapsService } from './swaps.service';

export class SwapsController {
  static async requestSwap(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const teamId = String(req.params.teamId);
      const { shiftId, type, targetUserId, reason } = req.body;

      const swap = await SwapsService.requestSwap(user.id, teamId, {
        shiftId,
        type,
        targetUserId,
        reason,
      });

      res.status(201).json({
        data: swap,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to request shift swap',
          details: {},
        },
      });
    }
  }

  static async claimOpenShift(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const teamId = String(req.params.teamId);
      const swapId = String(req.params.swapId);

      const result = await SwapsService.claimOpenShift(user.id, teamId, swapId);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to claim open shift',
          details: {},
        },
      });
    }
  }

  static async approveSwap(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const teamId = String(req.params.teamId);
      const swapId = String(req.params.swapId);

      const result = await SwapsService.approveSwap(user.id, teamId, swapId);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to approve swap',
          details: {},
        },
      });
    }
  }

  static async rejectSwap(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const teamId = String(req.params.teamId);
      const swapId = String(req.params.swapId);
      const { reason } = req.body;

      const result = await SwapsService.rejectSwap(user.id, teamId, swapId, reason);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to reject swap',
          details: {},
        },
      });
    }
  }

  static async getTeamSwaps(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const status = req.query.status as string;

      const swaps = await SwapsService.getTeamSwaps(teamId, status);
      res.status(200).json({
        data: swaps,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve swap requests',
          details: {},
        },
      });
    }
  }
}

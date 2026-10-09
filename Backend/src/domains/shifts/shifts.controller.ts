import { Request, Response } from 'express';
import { ShiftsService } from './shifts.service';

export class ShiftsController {
  static async createShift(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const teamId = String(req.params.teamId);
      const { assignedToId, roleName, startTime, endTime, notes } = req.body;

      const shift = await ShiftsService.createShift(user.id, teamId, {
        assignedToId,
        roleName,
        startTime,
        endTime,
        notes,
      });

      res.status(201).json({
        data: shift,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to create shift',
          details: {},
        },
      });
    }
  }

  static async getShifts(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const { start, end, assignedToId } = req.query;

      const shifts = await ShiftsService.getShifts(teamId, {
        start: start as string,
        end: end as string,
        assignedToId: assignedToId as string,
      });

      res.status(200).json({
        data: shifts,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to retrieve shifts',
          details: {},
        },
      });
    }
  }

  static async updateShift(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const teamId = String(req.params.teamId);
      const shiftId = String(req.params.shiftId);
      const { assignedToId, roleName, startTime, endTime, notes, status } = req.body;

      const shift = await ShiftsService.updateShift(user.id, teamId, shiftId, {
        assignedToId,
        roleName,
        startTime,
        endTime,
        notes,
        status,
      });

      res.status(200).json({
        data: shift,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to update shift',
          details: {},
        },
      });
    }
  }

  static async cancelShift(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const teamId = String(req.params.teamId);
      const shiftId = String(req.params.shiftId);

      const result = await ShiftsService.cancelShift(user.id, teamId, shiftId);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to cancel shift',
          details: {},
        },
      });
    }
  }

  static async getActivityFeed(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const page = parseInt((req.query.page as string) || '1', 10);
      const limit = parseInt((req.query.limit as string) || '20', 10);

      const feed = await ShiftsService.getActivityFeed(teamId, page, limit);
      res.status(200).json({
        data: feed.items,
        meta: {
          ...feed.pagination,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve activity feed',
          details: {},
        },
      });
    }
  }
}

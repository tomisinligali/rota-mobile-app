import { Request, Response } from 'express';
import { UsersService } from './users.service';

export class UsersController {
  static async getSettings(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const settings = await UsersService.getSettings(user.id);
      res.status(200).json({
        data: settings,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to retrieve user settings',
          details: {},
        },
      });
    }
  }

  static async updateSettings(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const settings = await UsersService.updateSettings(user.id, req.body);
      res.status(200).json({
        data: settings,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to update user settings',
          details: {},
        },
      });
    }
  }
}

import { Request, Response } from 'express';
import { NotificationsService } from './notifications.service';

export class NotificationsController {
  static async registerPushToken(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { pushToken, deviceId, deviceType, deviceName } = req.body;

      const result = await NotificationsService.registerPushToken(
        user.id,
        pushToken,
        deviceId,
        deviceType,
        deviceName
      );
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to register push token',
          details: {},
        },
      });
    }
  }

  static async unregisterPushToken(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { deviceId, pushToken } = req.body;

      const result = await NotificationsService.unregisterPushToken(user.id, { deviceId, pushToken });
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to unregister push token',
          details: {},
        },
      });
    }
  }

  static async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const limit = parseInt(req.query.limit as string || '30', 10);

      const result = await NotificationsService.getUserNotifications(user.id, limit);
      res.status(200).json({
        data: result.items,
        meta: {
          unreadCount: result.unreadCount,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to retrieve notifications',
          details: {},
        },
      });
    }
  }

  static async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const notificationId = String(req.params.id);

      const result = await NotificationsService.markAsRead(user.id, notificationId);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to update notification',
          details: {},
        },
      });
    }
  }

  static async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const result = await NotificationsService.markAllAsRead(user.id);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to mark notifications read',
          details: {},
        },
      });
    }
  }
}

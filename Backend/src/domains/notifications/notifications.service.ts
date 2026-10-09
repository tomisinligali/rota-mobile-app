import { pool, query } from '../../db/pool';
import { notificationQueue } from './queue';

export interface CreateNotificationInput {
  userId: string;
  teamId?: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export class NotificationsService {
  /**
   * Persists durable notification intent and enqueues BullMQ job.
   * Can run within an existing database transaction client.
   */
  static async createNotification(input: CreateNotificationInput, dbClient?: any) {
    const { userId, teamId, type, title, body, data = {} } = input;
    const runner = dbClient || pool;

    const notifRes = await runner.query(
      `INSERT INTO notifications (user_id, team_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, team_id, type, title, body, data, is_read, created_at`,
      [userId, teamId || null, type, title, body, JSON.stringify(data)]
    );

    const notification = notifRes.rows[0];

    // Outbox record for durable delivery guarantee
    await runner.query(
      `INSERT INTO notification_outbox (notification_id, user_id, status)
       VALUES ($1, $2, 'PENDING')`,
      [notification.id, userId]
    );

    // Enqueue BullMQ asynchronous job
    try {
      await notificationQueue.add('send-notification', {
        notificationId: notification.id,
        userId,
        title,
        body,
        data,
      });
    } catch (err: any) {
      console.warn('BullMQ enqueue error (will be processed by durable outbox):', err.message);
    }

    return notification;
  }

  /**
   * Registers a user device push token (e.g. Expo token).
   */
  static async registerPushToken(userId: string, pushToken: string, deviceType = 'expo') {
    if (!pushToken || pushToken.trim().length === 0) {
      const err: any = new Error('Push token is required');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    await query(
      `INSERT INTO device_push_tokens (user_id, push_token, device_type, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, push_token)
       DO UPDATE SET updated_at = NOW()`,
      [userId, pushToken.trim(), deviceType]
    );

    return { registered: true, pushToken: pushToken.trim() };
  }

  /**
   * Retrieves paginated notifications and unread count for user.
   */
  static async getUserNotifications(userId: string, limit = 30) {
    const notifsRes = await query(
      `SELECT id, team_id, type, title, body, data, is_read, read_at, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    const unreadRes = await query(
      `SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return {
      items: notifsRes.rows,
      unreadCount: parseInt(unreadRes.rows[0]?.unread_count || '0', 10),
    };
  }

  /**
   * Marks a notification as read.
   */
  static async markAsRead(userId: string, notificationId: string) {
    const res = await query(
      `UPDATE notifications
       SET is_read = true, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_read`,
      [notificationId, userId]
    );

    if (res.rowCount === 0) {
      const err: any = new Error('Notification not found');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    return res.rows[0];
  }

  /**
   * Marks all notifications as read for a user.
   */
  static async markAllAsRead(userId: string) {
    await query(
      `UPDATE notifications
       SET is_read = true, read_at = NOW()
       WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    return { success: true };
  }
}

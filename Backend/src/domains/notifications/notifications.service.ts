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

    // Deep-linking target screen defaulting
    const enrichedData: Record<string, unknown> = { ...data };
    if (!enrichedData.screen) {
      const t = (type || '').toUpperCase();
      if (t.startsWith('SHIFT_')) {
        enrichedData.screen = 'shifts';
      } else if (t.startsWith('SWAP_') || t.includes('OPEN_SHIFT')) {
        enrichedData.screen = 'swaps';
      } else if (
        t.startsWith('PAYMENT_') ||
        t.startsWith('SUBSCRIPTION_') ||
        t.startsWith('TRIAL_') ||
        t.includes('BILLING')
      ) {
        enrichedData.screen = 'profile';
        enrichedData.subTab = 'billing';
      } else {
        enrichedData.screen = 'feed';
      }
    }

    const notifRes = await runner.query(
      `INSERT INTO notifications (user_id, team_id, type, title, body, data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id, team_id, type, title, body, data, is_read, created_at`,
      [userId, teamId || null, type, title, body, JSON.stringify(enrichedData)]
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
        type,
        title,
        body,
        data: enrichedData,
      });
    } catch (err: any) {
      console.warn('BullMQ enqueue error (will be processed by durable outbox):', err.message);
    }

    return notification;
  }

  /**
   * Registers a user device push token.
   * Supports multiple devices per user identified by deviceId.
   */
  static async registerPushToken(
    userId: string,
    pushToken: string,
    deviceId?: string,
    deviceType = 'expo',
    deviceName?: string
  ) {
    if (!pushToken || pushToken.trim().length === 0) {
      const err: any = new Error('Push token is required');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    const trimmedToken = pushToken.trim();
    const trimmedDeviceId = deviceId?.trim();

    if (trimmedDeviceId) {
      // If token belonged to another user on the same device, detach it
      await query(
        `DELETE FROM device_push_tokens WHERE push_token = $1 AND user_id != $2`,
        [trimmedToken, userId]
      );

      // Upsert by user_id and device_id
      await query(
        `INSERT INTO device_push_tokens (user_id, push_token, device_id, device_type, device_name, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id, device_id) WHERE device_id IS NOT NULL
         DO UPDATE SET push_token = $2, device_type = $4, device_name = $5, updated_at = NOW()`,
        [userId, trimmedToken, trimmedDeviceId, deviceType, deviceName || null]
      );
    } else {
      // Fallback if client doesn't send deviceId
      await query(
        `INSERT INTO device_push_tokens (user_id, push_token, device_type, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, push_token)
         DO UPDATE SET updated_at = NOW()`,
        [userId, trimmedToken, deviceType]
      );
    }

    return { registered: true, pushToken: trimmedToken, deviceId: trimmedDeviceId };
  }

  /**
   * Unregisters a device push token on logout.
   */
  static async unregisterPushToken(userId: string, params: { deviceId?: string; pushToken?: string }) {
    if (params.deviceId) {
      await query(
        `DELETE FROM device_push_tokens WHERE user_id = $1 AND device_id = $2`,
        [userId, params.deviceId.trim()]
      );
    } else if (params.pushToken) {
      await query(
        `DELETE FROM device_push_tokens WHERE user_id = $1 AND push_token = $2`,
        [userId, params.pushToken.trim()]
      );
    }
    return { unregistered: true };
  }

  /**
   * Deletes invalid push tokens reported by push delivery provider.
   */
  static async deleteInvalidPushTokens(tokens: string[]) {
    if (!tokens || tokens.length === 0) return { deletedCount: 0 };
    const res = await query(
      `DELETE FROM device_push_tokens WHERE push_token = ANY($1) RETURNING push_token`,
      [tokens]
    );
    return { deletedCount: res.rowCount || 0, tokens: res.rows.map((r) => r.push_token) };
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

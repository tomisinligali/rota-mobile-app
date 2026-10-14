import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { query } from '../../db/pool';
import { PushService } from './push.service';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

export const redisConnection = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
});

export interface NotificationJobData {
  notificationId: string;
  userId: string;
  type?: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  urgent?: boolean;
  quietHoursDeferred?: boolean;
}

/**
 * Checks whether current time falls within the user's quiet hours in their local timezone.
 */
export function isInQuietHours(
  quietHoursStart: string = '22:00',
  quietHoursEnd: string = '08:00',
  timezone: string = 'UTC',
  referenceDate: Date = new Date()
): { inQuietHours: boolean; msUntilEnd: number } {
  try {
    const now = referenceDate;
    const tz = timezone && timezone.trim() ? timezone.trim() : 'UTC';

    // Format local time parts in the user's timezone
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);

    const hourStr = parts.find((p) => p.type === 'hour')?.value || '00';
    const minStr = parts.find((p) => p.type === 'minute')?.value || '00';
    const currentMinutes = parseInt(hourStr, 10) * 60 + parseInt(minStr, 10);

    const [startH, startM] = (quietHoursStart || '22:00').split(':').map((s) => parseInt(s, 10));
    const [endH, endM] = (quietHoursEnd || '08:00').split(':').map((s) => parseInt(s, 10));

    const startMinutes = (isNaN(startH) ? 22 : startH) * 60 + (isNaN(startM) ? 0 : startM);
    const endMinutes = (isNaN(endH) ? 8 : endH) * 60 + (isNaN(endM) ? 0 : endM);

    let inQuietHours = false;
    let minutesUntilEnd = 0;

    if (startMinutes > endMinutes) {
      // Crosses midnight, e.g. 22:00 (1320) to 08:00 (480)
      if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
        inQuietHours = true;
        if (currentMinutes >= startMinutes) {
          minutesUntilEnd = (1440 - currentMinutes) + endMinutes;
        } else {
          minutesUntilEnd = endMinutes - currentMinutes;
        }
      }
    } else if (startMinutes < endMinutes) {
      // Single daytime window, e.g. 13:00 to 15:00
      if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
        inQuietHours = true;
        minutesUntilEnd = endMinutes - currentMinutes;
      }
    }

    // Convert minutes until quiet hours end to milliseconds (with 10s buffer)
    const msUntilEnd = inQuietHours ? Math.max(10000, (minutesUntilEnd * 60 + 10) * 1000) : 0;

    return { inQuietHours, msUntilEnd };
  } catch (err) {
    console.warn(`Timezone parsing failed for "${timezone}":`, err);
    return { inQuietHours: false, msUntilEnd: 0 };
  }
}

/**
 * Checks whether the notification type is enabled in the user's category preferences.
 */
export function isNotificationTypeAllowed(
  type: string,
  settings: {
    push_notifications?: boolean;
    notify_shift_changes?: boolean;
    notify_swaps?: boolean;
    notify_billing?: boolean;
  } | null
): boolean {
  if (!settings) return true;
  if (settings.push_notifications === false) return false;

  const t = (type || '').toUpperCase();
  if (t.startsWith('SHIFT_') && settings.notify_shift_changes === false) {
    return false;
  }
  if ((t.startsWith('SWAP_') || t.includes('OPEN_SHIFT')) && settings.notify_swaps === false) {
    return false;
  }
  if (
    (t.startsWith('PAYMENT_') ||
      t.startsWith('SUBSCRIPTION_') ||
      t.startsWith('TRIAL_') ||
      t.includes('BILLING') ||
      t.includes('RESTRICTED')) &&
    settings.notify_billing === false
  ) {
    return false;
  }

  return true;
}

export const notificationQueue = new Queue<NotificationJobData>('notification-delivery', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const notificationWorker = new Worker<NotificationJobData>(
  'notification-delivery',
  async (job: Job<NotificationJobData>) => {
    const { notificationId, userId, title, body, data, urgent, quietHoursDeferred } = job.data;
    let notifType = job.data.type;

    // Atomic claim / update outbox to PROCESSING
    await query(
      `UPDATE notification_outbox 
       SET status = 'PROCESSING', last_attempt_at = NOW(), attempts = attempts + 1, updated_at = NOW()
       WHERE notification_id = $1`,
      [notificationId]
    );

    // If type wasn't supplied directly in job data, resolve it from notifications table
    if (!notifType) {
      const nRes = await query(`SELECT type FROM notifications WHERE id = $1`, [notificationId]);
      notifType = nRes.rows[0]?.type || 'GENERAL';
    }
    const resolvedType = notifType || 'GENERAL';

    // Fetch user preferences (push notification master switch, categories, quiet hours, timezone)
    const settingsRes = await query(
      `SELECT push_notifications, notify_shift_changes, notify_swaps, notify_billing,
              quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone
       FROM user_settings
       WHERE user_id = $1`,
      [userId]
    );
    const settings = settingsRes.rows[0] || null;

    // 1. Check notification category preferences
    if (settings && !isNotificationTypeAllowed(resolvedType, settings)) {
      console.log(`[NotificationWorker] Push skipped for user ${userId}: category "${resolvedType}" disabled in user settings.`);
      await query(
        `UPDATE notification_outbox 
         SET status = 'SUCCEEDED', updated_at = NOW()
         WHERE notification_id = $1`,
        [notificationId]
      );
      return { processed: true, pushSuppressedByPreference: true };
    }

    // 2. Check quiet hours (unless job is flagged urgent or already deferred past quiet hours)
    if (settings && settings.quiet_hours_enabled && !urgent && !quietHoursDeferred) {
      const quiet = isInQuietHours(
        settings.quiet_hours_start,
        settings.quiet_hours_end,
        settings.timezone
      );

      if (quiet.inQuietHours && quiet.msUntilEnd > 0) {
        console.log(
          `[NotificationWorker] Notification ${notificationId} for user ${userId} deferred due to quiet hours (${settings.timezone}). Delaying ${Math.round(quiet.msUntilEnd / 1000)}s.`
        );

        // Update outbox next_attempt_at
        await query(
          `UPDATE notification_outbox 
           SET status = 'PENDING', next_attempt_at = NOW() + ($1 || ' milliseconds')::INTERVAL, updated_at = NOW()
           WHERE notification_id = $2`,
          [quiet.msUntilEnd, notificationId]
        );

        // Re-enqueue BullMQ job with exact delay until quiet hours end
        await notificationQueue.add(
          'send-notification',
          {
            ...job.data,
            type: notifType,
            quietHoursDeferred: true,
          },
          {
            delay: quiet.msUntilEnd,
          }
        );

        return { deferred: true, msUntilEnd: quiet.msUntilEnd };
      }
    }

    // 3. Fetch device push tokens for user (one user can have multiple devices)
    const tokenRes = await query(
      `SELECT push_token FROM device_push_tokens WHERE user_id = $1`,
      [userId]
    );

    let sentCount = 0;
    if (tokenRes.rowCount && tokenRes.rowCount > 0) {
      const tokens = tokenRes.rows.map((r) => r.push_token);
      const pushResult = await PushService.sendPushNotification({
        to: tokens,
        title,
        body,
        data,
      });

      sentCount = pushResult.sentCount;

      // Handle invalid tokens reported by the push service: delete immediately from server
      if (pushResult.invalidTokens && pushResult.invalidTokens.length > 0) {
        console.log(
          `[NotificationWorker] Deleting ${pushResult.invalidTokens.length} invalid token(s) reported by push service:`,
          pushResult.invalidTokens
        );
        await query(
          `DELETE FROM device_push_tokens WHERE push_token = ANY($1)`,
          [pushResult.invalidTokens]
        );
      }
    }

    // 4. Mark outbox SUCCEEDED
    await query(
      `UPDATE notification_outbox 
       SET status = 'SUCCEEDED', updated_at = NOW()
       WHERE notification_id = $1`,
      [notificationId]
    );

    return { processed: true, tokensSent: sentCount };
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

notificationWorker.on('failed', async (job, err) => {
  if (job) {
    const isDead = job.attemptsMade >= (job.opts.attempts || 5);
    await query(
      `UPDATE notification_outbox 
       SET status = $1, error_message = $2, updated_at = NOW()
       WHERE notification_id = $3`,
      [isDead ? 'DEAD' : 'FAILED', err.message, job.data.notificationId]
    );
  }
});

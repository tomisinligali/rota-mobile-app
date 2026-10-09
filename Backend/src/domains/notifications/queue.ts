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
  title: string;
  body: string;
  data?: Record<string, unknown>;
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
    const { notificationId, userId, title, body, data } = job.data;

    // Atomic claim / update outbox to PROCESSING
    await query(
      `UPDATE notification_outbox 
       SET status = 'PROCESSING', last_attempt_at = NOW(), attempts = attempts + 1, updated_at = NOW()
       WHERE notification_id = $1`,
      [notificationId]
    );

    // Fetch device push tokens for user
    const tokenRes = await query(
      `SELECT push_token FROM device_push_tokens WHERE user_id = $1`,
      [userId]
    );

    if (tokenRes.rowCount && tokenRes.rowCount > 0) {
      const tokens = tokenRes.rows.map((r) => r.push_token);
      await PushService.sendPushNotification({
        to: tokens,
        title,
        body,
        data,
      });
    }

    // Mark outbox SUCCEEDED
    await query(
      `UPDATE notification_outbox 
       SET status = 'SUCCEEDED', updated_at = NOW()
       WHERE notification_id = $1`,
      [notificationId]
    );

    return { processed: true, tokensSent: tokenRes.rowCount };
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

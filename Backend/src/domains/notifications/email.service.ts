import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { EmailMessage, getEmailProvider } from './email.provider';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

// Separate connection/queue from the push-notification queue so a stuck email
// provider cannot stall notification delivery (and vice versa).
const emailRedis = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue<EmailMessage>('email-delivery', {
  connection: emailRedis,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const emailWorker = new Worker<EmailMessage>(
  'email-delivery',
  async (job: Job<EmailMessage>) => {
    // Provider errors propagate so BullMQ retries with backoff.
    await getEmailProvider().send(job.data);
    return { delivered: true, to: job.data.to };
  },
  { connection: emailRedis, concurrency: 5 }
);

emailWorker.on('failed', (job, err) => {
  // Never log message bodies, subjects, or verification codes.
  console.error(`Email job ${job?.id ?? 'unknown'} failed: ${err.message}`);
});

export class EmailService {
  /**
   * Enqueues a transactional email for asynchronous, retry-safe delivery.
   * Persisting intent (the verification token row) already happened in the DB;
   * this only schedules delivery so the request never blocks on SMTP.
   */
  static async enqueue(message: EmailMessage): Promise<void> {
    await emailQueue.add('send-email', message);
  }

  /**
   * Sends the email-verification link. The token is delivered only to the
   * user's inbox; it is never logged.
   */
  static async sendVerificationLink(
    to: string,
    link: string,
    token: string,
    ttlMinutes: number
  ): Promise<void> {
    const text =
      `Welcome to Rota!\n\n` +
      `Confirm your email address by opening this link:\n${link}\n\n` +
      `This link expires in ${ttlMinutes} minutes and can only be used once.\n\n` +
      `If the link does not work, paste this token into the app:\n${token}\n\n` +
      `If you did not create a Rota account, you can safely ignore this email.`;

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a;">
        <h2 style="margin:0 0 8px;">Welcome to Rota</h2>
        <p style="margin:0 0 20px;color:#555;">Confirm your email address to finish setting up your account.</p>
        <p style="text-align:center;margin:0 0 20px;">
          <a href="${link}" style="display:inline-block;background:#6600CC;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">Verify my email</a>
        </p>
        <p style="margin:0 0 8px;color:#555;font-size:14px;">Or paste this token into the app:</p>
        <p style="margin:0 0 20px;font-family:monospace;font-size:12px;word-break:break-all;background:#f4f4f5;padding:12px;border-radius:6px;">${token}</p>
        <p style="margin:0;color:#888;font-size:12px;">This link expires in ${ttlMinutes} minutes and can only be used once. If you did not create a Rota account, you can ignore this email.</p>
      </div>`;

    await EmailService.enqueue({
      to,
      subject: 'Verify your Rota email address',
      text,
      html,
    });
  }
}

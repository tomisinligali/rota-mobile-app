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
   * Persisting intent (the verification code row) already happened in the DB;
   * this only schedules delivery so the request never blocks on SMTP.
   */
  static async enqueue(message: EmailMessage): Promise<void> {
    await emailQueue.add('send-email', message);
  }

  /**
   * Sends the email-verification code. The code is delivered only to the
   * user's inbox; it is never logged.
   */
  static async sendVerificationCode(
    to: string,
    code: string,
    ttlMinutes: number
  ): Promise<void> {
    const text =
      `Welcome to Rota!\n\n` +
      `Your email verification code is:\n\n${code}\n\n` +
      `Enter this code in the Rota app to confirm your email address. ` +
      `The code expires in ${ttlMinutes} minutes and can only be used once.\n\n` +
      `If you did not create a Rota account, you can safely ignore this email.`;

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a;">
        <h2 style="margin:0 0 8px;">Welcome to Rota</h2>
        <p style="margin:0 0 20px;color:#555;">Enter this code in the app to confirm your email address.</p>
        <p style="text-align:center;margin:0 0 20px;">
          <span style="display:inline-block;font-family:monospace;font-size:32px;letter-spacing:8px;font-weight:700;color:#6600CC;background:#F4F0FB;padding:16px 24px;border-radius:8px;">${code}</span>
        </p>
        <p style="margin:0;color:#888;font-size:12px;">This code expires in ${ttlMinutes} minutes and can only be used once. If you did not create a Rota account, you can ignore this email.</p>
      </div>`;

    await EmailService.enqueue({
      to,
      subject: 'Your Rota verification code',
      text,
      html,
    });
  }

  /**
   * Sends the password-reset code. The secret is delivered only to the
   * user's inbox; it is never logged.
   */
  static async sendPasswordReset(
    to: string,
    code: string,
    ttlMinutes: number
  ): Promise<void> {
    const text =
      `Hello,\n\n` +
      `You requested a password reset for your Rota account.\n\n` +
      `Your password reset code is:\n\n${code}\n\n` +
      `Enter this code in the Rota app to choose a new password. ` +
      `This code expires in ${ttlMinutes} minutes and can only be used once.\n\n` +
      `If you did not request a password reset, please ignore this email; your account remains secure.`;

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a;">
        <h2 style="margin:0 0 8px;">Reset Your Password</h2>
        <p style="margin:0 0 20px;color:#555;">Use this code to reset your Rota account password.</p>
        <p style="text-align:center;margin:0 0 20px;">
          <span style="display:inline-block;font-family:monospace;font-size:32px;letter-spacing:8px;font-weight:700;color:#6600CC;background:#F4F0FB;padding:16px 24px;border-radius:8px;">${code}</span>
        </p>
        <p style="margin:0;color:#888;font-size:12px;">This code expires in ${ttlMinutes} minutes and can only be used once. If you did not request this, you can safely ignore this email.</p>
      </div>`;

    await EmailService.enqueue({
      to,
      subject: 'Your Rota password reset code',
      text,
      html,
    });
  }

  /**
   * Sends a team invitation email containing the deep link and token.
   */
  static async sendInvitation(
    to: string,
    inviterName: string,
    teamName: string,
    inviteToken: string
  ): Promise<void> {
    const deepLink = `rota://invite/${inviteToken}`;
    const text =
      `Hello,\n\n` +
      `${inviterName} has invited you to join the team "${teamName}" on Rota.\n\n` +
      `Open this link on your mobile device to join:\n${deepLink}\n\n` +
      `Or enter this invitation code in the app:\n${inviteToken}`;

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a;">
        <h2 style="margin:0 0 8px;">You're Invited!</h2>
        <p style="margin:0 0 20px;color:#555;"><strong>${inviterName}</strong> has invited you to join <strong>${teamName}</strong> on Rota.</p>
        <p style="text-align:center;margin:0 0 24px;">
          <a href="${deepLink}" style="display:inline-block;background:#6600CC;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:100px;font-weight:600;">Join Team</a>
        </p>
        <p style="color:#666;font-size:13px;margin:0 0 8px;">Or copy your invitation code into the app:</p>
        <p style="text-align:center;margin:0 0 20px;">
          <span style="display:inline-block;font-family:monospace;font-size:18px;letter-spacing:2px;font-weight:700;color:#6600CC;background:#F4F0FB;padding:10px 18px;border-radius:8px;">${inviteToken}</span>
        </p>
      </div>`;

    await EmailService.enqueue({
      to,
      subject: `You've been invited to join ${teamName} on Rota`,
      text,
      html,
    });
  }

  /**
   * Sends billing renewal failure and grace period notification to the business owner.
   */
  static async sendBillingFailureNotification(
    to: string,
    businessName: string,
    daysRemaining: number
  ): Promise<void> {
    const text =
      `Hello,\n\n` +
      `We were unable to process your subscription renewal for ${businessName}.\n\n` +
      `Your account has entered a ${daysRemaining}-day grace period. Please update your payment method to avoid service interruption and restricted access.\n\n` +
      `Your schedules and historical workforce records remain preserved.\n`;

    const html = `
      <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a;">
        <h2 style="margin:0 0 8px;color:#BA1A1A;">Subscription Renewal Notice</h2>
        <p style="margin:0 0 16px;color:#555;">We were unable to process your renewal payment for <strong>${businessName}</strong>.</p>
        <p style="margin:0 0 16px;color:#555;">Your account is now in a <strong>${daysRemaining}-day grace period</strong>. Please update your payment method to ensure continued access to shift scheduling.</p>
        <p style="margin:0;color:#888;font-size:12px;">All team schedules and history remain safe and intact.</p>
      </div>`;

    await EmailService.enqueue({
      to,
      subject: `Payment failed for ${businessName} - Action required`,
      text,
      html,
    });
  }
}

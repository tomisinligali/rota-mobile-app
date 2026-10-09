import nodemailer, { Transporter } from 'nodemailer';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
  verifyConnection(): Promise<void>;
}

/**
 * SMTP implementation (Gmail by default). Provider-specific transport details
 * are confined to this module so the rest of the domain depends only on the
 * EmailProvider interface and can be switched without touching auth code.
 */
class SmtpEmailProvider implements EmailProvider {
  private transporter: Transporter;
  private from: string;

  constructor() {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!user || !pass) {
      const err: any = new Error('Email provider is not configured');
      err.code = 'EMAIL_NOT_CONFIGURED';
      throw err;
    }

    this.from = process.env.EMAIL_FROM || user;
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '465', 10),
      // Gmail uses implicit TLS on 465. Set SMTP_SECURE=false for 587 (STARTTLS).
      secure: (process.env.SMTP_SECURE || 'true') === 'true',
      auth: { user, pass },
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  async verifyConnection(): Promise<void> {
    await this.transporter.verify();
  }
}

let cachedProvider: EmailProvider | null = null;

/**
 * Lazily constructs the provider so a missing configuration surfaces at send
 * time (inside the retryable worker) rather than crashing server startup.
 */
export function getEmailProvider(): EmailProvider {
  if (!cachedProvider) {
    cachedProvider = new SmtpEmailProvider();
  }
  return cachedProvider;
}

/**
 * Optional startup check. Returns false (instead of throwing) when SMTP is
 * not configured, so the API still starts in development.
 */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await getEmailProvider().verifyConnection();
    return true;
  } catch (err: any) {
    console.warn(`Email provider not ready: ${err.message}`);
    return false;
  }
}

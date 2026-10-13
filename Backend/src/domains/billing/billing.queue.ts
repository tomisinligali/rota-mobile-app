import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { BillingService } from './billing.service';

const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379', 10);

const billingRedis = new IORedis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  maxRetriesPerRequest: null,
});

export interface WebhookJobData {
  providerEventId: string;
  payload: any;
  signature?: string;
  receivedAt: string;
}

export const billingWebhookQueue = new Queue<WebhookJobData>('billing-webhooks', {
  connection: billingRedis,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

export const billingWebhookWorker = new Worker<WebhookJobData>(
  'billing-webhooks',
  async (job: Job<WebhookJobData>) => {
    const { payload, signature } = job.data;
    return await BillingService.processVerifiedWebhook(payload, signature);
  },
  {
    connection: billingRedis,
    concurrency: 5,
  }
);

billingWebhookWorker.on('failed', (job, err) => {
  console.error(`Billing webhook job ${job?.id ?? 'unknown'} failed: ${err.message}`);
});

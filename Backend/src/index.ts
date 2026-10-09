import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './domains/auth/auth.routes';
import dashboardRoutes from './domains/dashboard/dashboard.routes';
import teamsRoutes from './domains/teams/teams.routes';
import invitationsRoutes from './domains/invitations/invitations.routes';
import shiftsRoutes from './domains/shifts/shifts.routes';
import swapsRoutes from './domains/swaps/swaps.routes';
import billingRoutes from './domains/billing/billing.routes';
import notificationsRoutes from './domains/notifications/notifications.routes';
import usersRoutes from './domains/users/users.routes';
import { verifyEmailConnection } from './domains/notifications/email.provider';
import { pool } from './db/pool';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Global Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Trim empty spaces at the end of all string input fields in requests
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === 'object') {
    const trimTrailing = (obj: any) => {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].trimEnd();
        } else if (Array.isArray(obj[key])) {
          obj[key] = obj[key].map((item: any) => {
            if (typeof item === 'string') return item.trimEnd();
            if (item && typeof item === 'object') {
              trimTrailing(item);
            }
            return item;
          });
        } else if (obj[key] && typeof obj[key] === 'object') {
          trimTrailing(obj[key]);
        }
      }
    };
    trimTrailing(req.body);
  }
  next();
});

// Health Check Endpoint per PRD & Task
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const dbRes = await pool.query('SELECT 1 as connected');
    const isDbConnected = dbRes.rows[0]?.connected === 1;

    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: isDbConnected ? 'connected' : 'disconnected',
    });
  } catch (err: any) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      database: 'error',
      message: err.message,
    });
  }
});

// Domain Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/teams', teamsRoutes);
app.use('/api/v1/invitations', invitationsRoutes);
app.use('/api/v1/shifts', shiftsRoutes);
app.use('/api/v1/swaps', swapsRoutes);
app.use('/api/v1/billing', billingRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/users', usersRoutes);

// 404 Handler per PRD Envelope
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found',
      details: {},
    },
  });
});

// Global Error Handler per PRD Envelope
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.details || {} : {},
    },
  });
});

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`Rota API server running on http://${HOST}:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);

    // Non-fatal SMTP readiness check — the API still starts if email is not
    // configured yet, but this makes the problem obvious in the logs.
    verifyEmailConnection().then((ok) => {
      console.log(
        ok
          ? 'Email provider ready (SMTP connection verified)'
          : 'Email provider NOT configured — verification emails will not send'
      );
    });
  });
}

export default app;

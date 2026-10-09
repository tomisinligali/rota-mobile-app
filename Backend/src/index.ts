import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './domains/auth/auth.routes';
import dashboardRoutes from './domains/dashboard/dashboard.routes';
import teamsRoutes from './domains/teams/teams.routes';
import invitationsRoutes from './domains/invitations/invitations.routes';
import { pool } from './db/pool';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5001', 10);
const HOST = process.env.HOST || '0.0.0.0';

// Global Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

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
  });
}

export default app;

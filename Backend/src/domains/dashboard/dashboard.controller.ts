import { Request, Response } from 'express';
import { query } from '../../db/pool';

export class DashboardController {
  static async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;

      // Retrieve user's verified status and registration date directly from PostgreSQL
      const userDb = await query(
        `SELECT id, email, first_name, last_name, status, email_verified_at, created_at
         FROM users WHERE id = $1`,
        [user.id]
      );

      const userData = userDb.rows[0];

      // Retrieve any active sessions count for user
      const sessionsDb = await query(
        `SELECT COUNT(*) as active_sessions
         FROM sessions
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
        [user.id]
      );

      const activeSessions = parseInt(sessionsDb.rows[0].active_sessions, 10);

      res.status(200).json({
        data: {
          profile: {
            id: userData.id,
            email: userData.email,
            firstName: userData.first_name,
            lastName: userData.last_name,
            status: userData.status,
            isEmailVerified: !!userData.email_verified_at,
            createdAt: userData.created_at,
          },
          metrics: {
            activeSessions,
            activeTeams: 0,
            upcomingShifts: 0,
            pendingSwaps: 0,
          },
          systemStatus: {
            environment: process.env.NODE_ENV || 'development',
            database: 'connected',
            serverTime: new Date().toISOString(),
          },
        },
        meta: {
          timestamp: new Date().toISOString(),
          apiVersion: 'v1',
        },
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch dashboard summary',
          details: {},
        },
      });
    }
  }
}

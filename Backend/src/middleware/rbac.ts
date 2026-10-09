import { Request, Response, NextFunction } from 'express';
import { query } from '../db/pool';

export type Role = 'OWNER' | 'MANAGER' | 'STAFF';

export interface TeamMemberContext {
  membershipId: string;
  teamId: string;
  businessId: string;
  role: Role;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      teamContext?: TeamMemberContext;
    }
  }
}

/**
 * Middleware that verifies the authenticated user belongs to the specified team
 * and holds one of the required roles.
 */
export function requireTeamRole(allowedRoles: Role[]) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            details: {},
          },
        });
        return;
      }

      // teamId can come from route params or body/query
      const teamId = req.params.teamId || req.body.teamId || (req.query.teamId as string);
      if (!teamId) {
        res.status(400).json({
          error: {
            code: 'MISSING_TEAM_ID',
            message: 'Team identifier is required for this operation',
            details: {},
          },
        });
        return;
      }

      const resMembership = await query(
        `SELECT tm.id as membership_id, tm.team_id, tm.role, tm.status, t.business_id
         FROM team_memberships tm
         JOIN teams t ON t.id = tm.team_id
         WHERE tm.user_id = $1 AND tm.team_id = $2 AND tm.status = 'ACTIVE'`,
        [user.id, teamId]
      );

      if (resMembership.rowCount === 0) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'You are not an active member of this team',
            details: {},
          },
        });
        return;
      }

      const member = resMembership.rows[0];
      const memberRole = member.role as Role;

      if (!allowedRoles.includes(memberRole)) {
        res.status(403).json({
          error: {
            code: 'INSUFFICIENT_PERMISSIONS',
            message: `Operation requires one of the following roles: ${allowedRoles.join(', ')}`,
            details: { currentRole: memberRole, requiredRoles: allowedRoles },
          },
        });
        return;
      }

      req.teamContext = {
        membershipId: member.membership_id,
        teamId: member.team_id,
        businessId: member.business_id,
        role: memberRole,
        status: member.status,
      };

      next();
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error verifying team authorization',
          details: {},
        },
      });
    }
  };
}

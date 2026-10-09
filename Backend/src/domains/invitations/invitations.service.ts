import crypto from 'crypto';
import { pool, query } from '../../db/pool';
import { Role } from '../../middleware/rbac';

export interface CreateInvitationInput {
  email?: string;
  role?: Role;
  expiresInDays?: number;
}

export class InvitationsService {
  static async createInvitation(
    invitedById: string,
    teamId: string,
    input: CreateInvitationInput
  ) {
    const { email, role = 'STAFF', expiresInDays = 7 } = input;

    if (!['OWNER', 'MANAGER', 'STAFF'].includes(role)) {
      const err: any = new Error('Invalid role specified');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    if (role === 'OWNER') {
      const err: any = new Error('Cannot invite members directly as Owner');
      err.code = 'FORBIDDEN';
      err.status = 403;
      throw err;
    }

    // Check if email already belongs to team
    if (email) {
      const existingMember = await query(
        `SELECT tm.id FROM team_memberships tm
         JOIN users u ON u.id = tm.user_id
         WHERE tm.team_id = $1 AND LOWER(u.email) = LOWER($2) AND tm.status = 'ACTIVE'`,
        [teamId, email.trim()]
      );

      if (existingMember.rowCount && existingMember.rowCount > 0) {
        const err: any = new Error('A user with this email is already a member of this team');
        err.code = 'ALREADY_MEMBER';
        err.status = 400;
        throw err;
      }
    }

    // Generate cryptographic token
    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const res = await query(
      `INSERT INTO invitations (team_id, invited_by_id, email, role, token, token_hash, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'PENDING', $7)
       RETURNING id, team_id, email, role, token, status, expires_at, created_at`,
      [teamId, invitedById, email?.trim().toLowerCase() || null, role, token, tokenHash, expiresAt]
    );

    const inv = res.rows[0];
    return {
      id: inv.id,
      teamId: inv.team_id,
      email: inv.email,
      role: inv.role,
      token: inv.token,
      status: inv.status,
      expiresAt: inv.expires_at,
      createdAt: inv.created_at,
    };
  }

  static async verifyInvitation(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const res = await query(
      `SELECT i.id, i.team_id, i.email, i.role, i.status, i.expires_at,
              t.name as team_name, b.name as business_name,
              u.first_name as inviter_first_name, u.last_name as inviter_last_name
       FROM invitations i
       JOIN teams t ON t.id = i.team_id
       JOIN businesses b ON b.id = t.business_id
       JOIN users u ON u.id = i.invited_by_id
       WHERE (i.token = $1 OR i.token_hash = $2)`,
      [token, tokenHash]
    );

    if (res.rowCount === 0) {
      const err: any = new Error('Invitation not found or invalid');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const inv = res.rows[0];
    const isExpired = new Date(inv.expires_at) < new Date();

    if (inv.status !== 'PENDING' || isExpired) {
      const err: any = new Error(
        isExpired ? 'Invitation has expired' : `Invitation is already ${inv.status.toLowerCase()}`
      );
      err.code = isExpired ? 'INVITATION_EXPIRED' : 'INVITATION_INVALID';
      err.status = 400;
      throw err;
    }

    return {
      id: inv.id,
      teamId: inv.team_id,
      teamName: inv.team_name,
      businessName: inv.business_name,
      role: inv.role,
      email: inv.email,
      inviterName: `${inv.inviter_first_name} ${inv.inviter_last_name || ''}`.trim(),
      expiresAt: inv.expires_at,
    };
  }

  static async acceptInvitation(userId: string, token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const invRes = await client.query(
        `SELECT i.id, i.team_id, i.role, i.status, i.expires_at, i.email
         FROM invitations i
         WHERE (i.token = $1 OR i.token_hash = $2)
         FOR UPDATE`,
        [token, tokenHash]
      );

      if (invRes.rowCount === 0) {
        const err: any = new Error('Invitation not found');
        err.code = 'NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const inv = invRes.rows[0];
      const isExpired = new Date(inv.expires_at) < new Date();

      if (inv.status !== 'PENDING' || isExpired) {
        const err: any = new Error(
          isExpired ? 'Invitation has expired' : `Invitation has already been ${inv.status.toLowerCase()}`
        );
        err.code = isExpired ? 'INVITATION_EXPIRED' : 'INVITATION_ALREADY_USED';
        err.status = 400;
        throw err;
      }

      // Check if user is already a member
      const existingMember = await client.query(
        `SELECT id, status FROM team_memberships WHERE user_id = $1 AND team_id = $2`,
        [userId, inv.team_id]
      );

      let membershipId: string;
      if (existingMember.rowCount && existingMember.rowCount > 0) {
        if (existingMember.rows[0].status === 'ACTIVE') {
          const err: any = new Error('You are already an active member of this team');
          err.code = 'ALREADY_MEMBER';
          err.status = 400;
          throw err;
        }
        // Reactivate membership with new role
        const reactivateRes = await client.query(
          `UPDATE team_memberships 
           SET role = $1, status = 'ACTIVE', joined_at = NOW(), deactivated_at = NULL
           WHERE id = $2
           RETURNING id`,
          [inv.role, existingMember.rows[0].id]
        );
        membershipId = reactivateRes.rows[0].id;
      } else {
        const newMemberRes = await client.query(
          `INSERT INTO team_memberships (user_id, team_id, role, status)
           VALUES ($1, $2, $3, 'ACTIVE')
           RETURNING id`,
          [userId, inv.team_id, inv.role]
        );
        membershipId = newMemberRes.rows[0].id;
      }

      // Mark invitation accepted
      await client.query(
        `UPDATE invitations SET status = 'ACCEPTED', accepted_at = NOW() WHERE id = $1`,
        [inv.id]
      );

      await client.query('COMMIT');

      return {
        membershipId,
        teamId: inv.team_id,
        role: inv.role,
        status: 'ACTIVE',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getTeamInvitations(teamId: string) {
    const res = await query(
      `SELECT i.id, i.email, i.role, i.token, i.status, i.expires_at, i.created_at,
              u.first_name, u.last_name
       FROM invitations i
       JOIN users u ON u.id = i.invited_by_id
       WHERE i.team_id = $1 AND i.status = 'PENDING' AND i.expires_at > NOW()
       ORDER BY i.created_at DESC`,
      [teamId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      token: r.token,
      status: r.status,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      invitedBy: `${r.first_name} ${r.last_name || ''}`.trim(),
    }));
  }

  static async revokeInvitation(teamId: string, invitationId: string) {
    await query(
      `UPDATE invitations SET status = 'REVOKED' WHERE id = $1 AND team_id = $2`,
      [invitationId, teamId]
    );
    return { success: true };
  }
}

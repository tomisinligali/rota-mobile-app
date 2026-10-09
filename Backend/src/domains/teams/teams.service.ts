import { pool, query } from '../../db/pool';
import { Role } from '../../middleware/rbac';

export interface CreateTeamInput {
  name: string;
  businessName?: string;
  timezone?: string;
}

export class TeamsService {
  static async createTeam(userId: string, input: CreateTeamInput) {
    const { name, businessName, timezone = 'UTC' } = input;

    if (!name || name.trim().length === 0) {
      const err: any = new Error('Team name is required');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if user already owns a business or create a new one
      const existingOwnedBiz = await client.query(
        `SELECT b.id FROM businesses b
         JOIN teams t ON t.business_id = b.id
         JOIN team_memberships tm ON tm.team_id = t.id
         WHERE tm.user_id = $1 AND tm.role = 'OWNER' AND tm.status = 'ACTIVE'
         LIMIT 1`,
        [userId]
      );

      let businessId: string;
      if (existingOwnedBiz.rowCount && existingOwnedBiz.rowCount > 0) {
        businessId = existingOwnedBiz.rows[0].id;
      } else {
        const bName = businessName?.trim() || `${name.trim()} Org`;
        const bizRes = await client.query(
          `INSERT INTO businesses (name, default_timezone)
           VALUES ($1, $2)
           RETURNING id`,
          [bName, timezone]
        );
        businessId = bizRes.rows[0].id;
      }

      // Create Team
      const teamRes = await client.query(
        `INSERT INTO teams (business_id, name, timezone, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id, business_id, name, timezone, is_active, created_at`,
        [businessId, name.trim(), timezone]
      );
      const team = teamRes.rows[0];

      // Create OWNER membership
      await client.query(
        `INSERT INTO team_memberships (user_id, team_id, role, status)
         VALUES ($1, $2, 'OWNER', 'ACTIVE')`,
        [userId, team.id]
      );

      await client.query('COMMIT');

      return {
        ...team,
        userRole: 'OWNER',
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getUserTeams(userId: string) {
    const res = await query(
      `SELECT t.id, t.business_id, t.name, t.timezone, t.is_active, t.created_at,
              b.name as business_name,
              tm.role as user_role, tm.status as membership_status,
              (SELECT COUNT(*) FROM team_memberships m WHERE m.team_id = t.id AND m.status = 'ACTIVE') as member_count
       FROM teams t
       JOIN businesses b ON b.id = t.business_id
       JOIN team_memberships tm ON tm.team_id = t.id
       WHERE tm.user_id = $1 AND tm.status = 'ACTIVE' AND t.is_active = true
       ORDER BY t.created_at ASC`,
      [userId]
    );

    return res.rows.map((r) => ({
      id: r.id,
      businessId: r.business_id,
      businessName: r.business_name,
      name: r.name,
      timezone: r.timezone,
      isActive: r.is_active,
      createdAt: r.created_at,
      userRole: r.user_role,
      memberCount: parseInt(r.member_count, 10),
    }));
  }

  static async getTeamDetails(teamId: string) {
    const res = await query(
      `SELECT t.id, t.business_id, t.name, t.timezone, t.is_active, t.created_at,
              b.name as business_name,
              (SELECT COUNT(*) FROM team_memberships m WHERE m.team_id = t.id AND m.status = 'ACTIVE') as member_count
       FROM teams t
       JOIN businesses b ON b.id = t.business_id
       WHERE t.id = $1`,
      [teamId]
    );

    if (res.rowCount === 0) {
      const err: any = new Error('Team not found');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const r = res.rows[0];
    return {
      id: r.id,
      businessId: r.business_id,
      businessName: r.business_name,
      name: r.name,
      timezone: r.timezone,
      isActive: r.is_active,
      createdAt: r.created_at,
      memberCount: parseInt(r.member_count, 10),
    };
  }

  static async getTeamMembers(teamId: string) {
    const res = await query(
      `SELECT tm.id as membership_id, tm.role, tm.status, tm.joined_at, tm.deactivated_at,
              u.id as user_id, u.email, u.first_name, u.last_name
       FROM team_memberships tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1
       ORDER BY 
         CASE tm.role 
           WHEN 'OWNER' THEN 1 
           WHEN 'MANAGER' THEN 2 
           ELSE 3 
         END,
         u.first_name ASC`,
      [teamId]
    );

    return res.rows.map((r) => ({
      membershipId: r.membership_id,
      userId: r.user_id,
      email: r.email,
      firstName: r.first_name,
      lastName: r.last_name,
      role: r.role,
      status: r.status,
      joinedAt: r.joined_at,
      deactivatedAt: r.deactivated_at,
    }));
  }

  static async updateMemberRole(
    actorRole: Role,
    teamId: string,
    membershipId: string,
    newRole: Role
  ) {
    if (!['OWNER', 'MANAGER', 'STAFF'].includes(newRole)) {
      const err: any = new Error('Invalid role specified');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    // Manager cannot grant OWNER or demote OWNER
    if (actorRole === 'MANAGER' && newRole === 'OWNER') {
      const err: any = new Error('Managers cannot transfer or assign the Owner role');
      err.code = 'FORBIDDEN';
      err.status = 403;
      throw err;
    }

    const targetRes = await query(
      `SELECT tm.id, tm.role, tm.user_id FROM team_memberships tm WHERE tm.id = $1 AND tm.team_id = $2`,
      [membershipId, teamId]
    );

    if (targetRes.rowCount === 0) {
      const err: any = new Error('Membership not found');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const target = targetRes.rows[0];
    if (actorRole === 'MANAGER' && target.role === 'OWNER') {
      const err: any = new Error('Managers cannot modify an Owner');
      err.code = 'FORBIDDEN';
      err.status = 403;
      throw err;
    }

    await query(`UPDATE team_memberships SET role = $1 WHERE id = $2`, [newRole, membershipId]);

    return {
      membershipId,
      role: newRole,
    };
  }

  static async deactivateMember(
    actorRole: Role,
    teamId: string,
    membershipId: string
  ) {
    const targetRes = await query(
      `SELECT tm.id, tm.role FROM team_memberships tm WHERE tm.id = $1 AND tm.team_id = $2`,
      [membershipId, teamId]
    );

    if (targetRes.rowCount === 0) {
      const err: any = new Error('Membership not found');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const target = targetRes.rows[0];
    if (target.role === 'OWNER') {
      const err: any = new Error('Cannot deactivate the team Owner');
      err.code = 'FORBIDDEN';
      err.status = 403;
      throw err;
    }

    if (actorRole === 'MANAGER' && target.role === 'MANAGER') {
      const err: any = new Error('Managers cannot deactivate other managers');
      err.code = 'FORBIDDEN';
      err.status = 403;
      throw err;
    }

    await query(
      `UPDATE team_memberships SET status = 'INACTIVE', deactivated_at = NOW() WHERE id = $1`,
      [membershipId]
    );

    return { success: true };
  }
}

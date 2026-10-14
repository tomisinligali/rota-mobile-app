import { pool, query } from '../../db/pool';
import { NotificationsService } from '../notifications/notifications.service';
import { BillingService } from '../billing/billing.service';
import { CacheService } from '../../lib/cache';

export interface CreateShiftInput {
  assignedToId?: string;
  roleName?: string;
  startTime: string;
  endTime: string;
  notes?: string;
}

export interface UpdateShiftInput {
  assignedToId?: string;
  roleName?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  status?: 'DRAFT' | 'PUBLISHED' | 'CANCELLED' | 'COMPLETED';
}

export class ShiftsService {
  static async createShift(
    creatorId: string,
    teamId: string,
    input: CreateShiftInput
  ) {
    const { assignedToId, roleName, startTime, endTime, notes } = input;

    const start = new Date(startTime);
    const end = new Date(endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      const err: any = new Error('Invalid start or end time format');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    if (start >= end) {
      const err: any = new Error('Shift start time must be before end time');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Enforce billing status: restricted subscription blocks scheduling mutations
      const teamRes = await client.query('SELECT business_id FROM teams WHERE id = $1', [teamId]);
      if (teamRes.rowCount && teamRes.rowCount > 0) {
        await BillingService.assertCanSchedule(teamRes.rows[0].business_id);
      }

      let assigneeName = 'Open Shift';
      if (assignedToId) {
        // Verify assignee is active team member
        const memRes = await client.query(
          `SELECT tm.id, u.first_name, u.last_name 
           FROM team_memberships tm
           JOIN users u ON u.id = tm.user_id
           WHERE tm.user_id = $1 AND tm.team_id = $2 AND tm.status = 'ACTIVE'`,
          [assignedToId, teamId]
        );

        if (memRes.rowCount === 0) {
          const err: any = new Error('Assignee is not an active member of this team');
          err.code = 'INVALID_ASSIGNEE';
          err.status = 400;
          throw err;
        }

        assigneeName = `${memRes.rows[0].first_name} ${memRes.rows[0].last_name || ''}`.trim();

        // Enforce shift overlap check per PRD Section 5.3.9
        const overlapRes = await client.query(
          `SELECT id FROM shifts
           WHERE assigned_to_id = $1 
             AND status != 'CANCELLED'
             AND start_time < $2 
             AND end_time > $3
           LIMIT 1`,
          [assignedToId, end.toISOString(), start.toISOString()]
        );

        if (overlapRes.rowCount && overlapRes.rowCount > 0) {
          const err: any = new Error('The staff member already has an overlapping shift during this time.');
          err.code = 'SHIFT_CONFLICT';
          err.status = 409;
          throw err;
        }
      }

      // Insert shift
      const shiftRes = await client.query(
        `INSERT INTO shifts (team_id, assigned_to_id, created_by_id, role_name, start_time, end_time, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, 'PUBLISHED', $7)
         RETURNING id, team_id, assigned_to_id, created_by_id, role_name, start_time, end_time, status, notes, created_at`,
        [teamId, assignedToId || null, creatorId, roleName || 'General', start.toISOString(), end.toISOString(), notes || null]
      );
      const shift = shiftRes.rows[0];

      // Log activity
      const desc = assignedToId
        ? `Scheduled shift for ${assigneeName} (${roleName || 'General'})`
        : `Created open shift (${roleName || 'General'})`;

      await client.query(
        `INSERT INTO activity_logs (team_id, actor_id, entity_type, entity_id, action, description, details)
         VALUES ($1, $2, 'SHIFT', $3, 'CREATED', $4, $5)`,
        [teamId, creatorId, shift.id, desc, JSON.stringify({ startTime, endTime, roleName, assignedToId })]
      );

      if (assignedToId) {
        await NotificationsService.createNotification(
          {
            userId: assignedToId,
            teamId,
            type: 'SHIFT_CREATED',
            title: 'New Shift Scheduled',
            body: `You have been scheduled for a ${roleName || 'General'} shift on ${start.toISOString().split('T')[0]}.`,
            data: { shiftId: shift.id, teamId },
          },
          client
        );
      }

      await client.query('COMMIT');
      await CacheService.invalidateTeamSchedule(teamId);

      return {
        id: shift.id,
        teamId: shift.team_id,
        assignedToId: shift.assigned_to_id,
        roleName: shift.role_name,
        startTime: shift.start_time,
        endTime: shift.end_time,
        status: shift.status,
        notes: shift.notes,
        createdAt: shift.created_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async getShifts(
    teamId: string,
    options: { start?: string; end?: string; assignedToId?: string }
  ) {
    const rangeKey = `${options.start || 'any'}_${options.end || 'any'}_${options.assignedToId || 'all'}`;
    const cached = await CacheService.getTeamShifts(teamId, rangeKey);
    if (cached) {
      return cached;
    }

    let queryText = `
      SELECT s.id, s.team_id, s.assigned_to_id, s.created_by_id, s.role_name,
             s.start_time, s.end_time, s.status, s.notes, s.created_at,
             u.first_name as assignee_first_name, u.last_name as assignee_last_name, u.email as assignee_email
      FROM shifts s
      LEFT JOIN users u ON u.id = s.assigned_to_id
      WHERE s.team_id = $1 AND s.status != 'CANCELLED'
    `;
    const params: unknown[] = [teamId];

    if (options.start) {
      params.push(options.start);
      queryText += ` AND s.end_time >= $${params.length}`;
    }

    if (options.end) {
      params.push(options.end);
      queryText += ` AND s.start_time <= $${params.length}`;
    }

    if (options.assignedToId) {
      params.push(options.assignedToId);
      queryText += ` AND s.assigned_to_id = $${params.length}`;
    }

    queryText += ` ORDER BY s.start_time ASC`;

    const res = await query(queryText, params);
    const shifts = res.rows.map((r) => ({
      id: r.id,
      teamId: r.team_id,
      assignedToId: r.assigned_to_id,
      assigneeName: r.assignee_first_name
        ? `${r.assignee_first_name} ${r.assignee_last_name || ''}`.trim()
        : null,
      assigneeEmail: r.assignee_email,
      roleName: r.role_name,
      startTime: r.start_time,
      endTime: r.end_time,
      status: r.status,
      notes: r.notes,
      createdAt: r.created_at,
    }));

    await CacheService.setTeamShifts(teamId, rangeKey, shifts);
    return shifts;
  }

  static async updateShift(
    editorId: string,
    teamId: string,
    shiftId: string,
    input: UpdateShiftInput
  ) {
    const existingRes = await query(
      `SELECT * FROM shifts WHERE id = $1 AND team_id = $2`,
      [shiftId, teamId]
    );

    if (existingRes.rowCount === 0) {
      const err: any = new Error('Shift not found');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const current = existingRes.rows[0];
    const newAssignedToId = input.assignedToId !== undefined ? input.assignedToId : current.assigned_to_id;
    const newStart = input.startTime ? new Date(input.startTime) : current.start_time;
    const newEnd = input.endTime ? new Date(input.endTime) : current.end_time;
    const newRole = input.roleName !== undefined ? input.roleName : current.role_name;
    const newNotes = input.notes !== undefined ? input.notes : current.notes;
    const newStatus = input.status || current.status;

    if (newStart >= newEnd) {
      const err: any = new Error('Shift start time must be before end time');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      if (newStatus !== 'CANCELLED') {
        const teamRes = await client.query('SELECT business_id FROM teams WHERE id = $1', [teamId]);
        if (teamRes.rowCount && teamRes.rowCount > 0) {
          await BillingService.assertCanSchedule(teamRes.rows[0].business_id);
        }
      }

      // Check overlap if assignee or times changed
      if (newAssignedToId && newStatus !== 'CANCELLED') {
        const overlapRes = await client.query(
          `SELECT id FROM shifts
           WHERE assigned_to_id = $1 
             AND id != $2
             AND status != 'CANCELLED'
             AND start_time < $3 
             AND end_time > $4
           LIMIT 1`,
          [newAssignedToId, shiftId, newEnd.toISOString(), newStart.toISOString()]
        );

        if (overlapRes.rowCount && overlapRes.rowCount > 0) {
          const err: any = new Error('The staff member already has an overlapping shift during this time.');
          err.code = 'SHIFT_CONFLICT';
          err.status = 409;
          throw err;
        }
      }

      await client.query(
        `UPDATE shifts
         SET assigned_to_id = $1, role_name = $2, start_time = $3, end_time = $4,
             notes = $5, status = $6, modified_by_id = $7, updated_at = NOW()
         WHERE id = $8 AND team_id = $9`,
        [newAssignedToId || null, newRole, newStart, newEnd, newNotes, newStatus, editorId, shiftId, teamId]
      );

      await client.query(
        `INSERT INTO activity_logs (team_id, actor_id, entity_type, entity_id, action, description, details)
         VALUES ($1, $2, 'SHIFT', $3, 'UPDATED', $4, $5)`,
        [teamId, editorId, shiftId, `Updated shift (${newRole})`, JSON.stringify(input)]
      );

      await client.query('COMMIT');
      await CacheService.invalidateTeamSchedule(teamId);

      return {
        id: shiftId,
        teamId,
        assignedToId: newAssignedToId,
        roleName: newRole,
        startTime: newStart,
        endTime: newEnd,
        status: newStatus,
        notes: newNotes,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async cancelShift(editorId: string, teamId: string, shiftId: string) {
    const shiftRes = await query(
      `SELECT role_name, assigned_to_id, start_time FROM shifts WHERE id = $1 AND team_id = $2`,
      [shiftId, teamId]
    );
    if (shiftRes.rowCount === 0) {
      const err: any = new Error('Shift not found');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const shift = shiftRes.rows[0];

    await query(
      `UPDATE shifts SET status = 'CANCELLED', modified_by_id = $1, updated_at = NOW()
       WHERE id = $2 AND team_id = $3`,
      [editorId, shiftId, teamId]
    );

    await query(
      `INSERT INTO activity_logs (team_id, actor_id, entity_type, entity_id, action, description, details)
       VALUES ($1, $2, 'SHIFT', $3, 'CANCELLED', $4, '{}')`,
      [teamId, editorId, shiftId, `Cancelled shift (${shift.role_name || 'General'})`]
    );

    if (shift.assigned_to_id) {
      await NotificationsService.createNotification({
        userId: shift.assigned_to_id,
        teamId,
        type: 'SHIFT_CANCELLED',
        title: 'Shift Cancelled',
        body: `Your ${shift.role_name || 'General'} shift on ${new Date(shift.start_time).toISOString().split('T')[0]} has been cancelled.`,
        data: { shiftId, teamId },
      });
    }

    await CacheService.invalidateTeamSchedule(teamId);
    return { success: true };
  }

  static async getActivityFeed(
    teamId: string,
    limit: number = 20,
    cursor?: string
  ) {
    const safeLimit = Math.max(1, Math.min(100, limit));
    const pageKey = `${safeLimit}_${cursor || 'first'}`;

    // Check Redis Cache for Activity Feed
    const cached = await CacheService.getActivityFeed(teamId, pageKey);
    if (cached) {
      return cached;
    }

    // Decode cursor if provided
    let decodedCursor: { createdAt: string; id: string } | null = null;
    if (cursor) {
      try {
        let raw = Buffer.from(cursor, 'base64url').toString('utf8');
        let parsed: any;
        try {
          parsed = JSON.parse(raw);
        } catch {
          raw = Buffer.from(cursor, 'base64').toString('utf8');
          parsed = JSON.parse(raw);
        }
        if (parsed && typeof parsed.createdAt === 'string' && typeof parsed.id === 'string') {
          decodedCursor = { createdAt: parsed.createdAt, id: parsed.id };
        }
      } catch {
        decodedCursor = null;
      }
    }

    let queryText: string;
    let params: any[];

    if (decodedCursor) {
      // Seek records older than (cursor.createdAt, cursor.id) using tuple comparison
      // to guarantee records with identical timestamps are not skipped or duplicated.
      queryText = `
        SELECT al.id, al.team_id, al.actor_id, al.entity_type, al.entity_id,
               al.action, al.description, al.details, al.created_at,
               u.first_name as actor_first_name, u.last_name as actor_last_name
        FROM activity_logs al
        JOIN users u ON u.id = al.actor_id
        WHERE al.team_id = $1
          AND (al.created_at, al.id) < ($2, $3)
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $4
      `;
      params = [teamId, decodedCursor.createdAt, decodedCursor.id, safeLimit + 1];
    } else {
      // First page
      queryText = `
        SELECT al.id, al.team_id, al.actor_id, al.entity_type, al.entity_id,
               al.action, al.description, al.details, al.created_at,
               u.first_name as actor_first_name, u.last_name as actor_last_name
        FROM activity_logs al
        JOIN users u ON u.id = al.actor_id
        WHERE al.team_id = $1
        ORDER BY al.created_at DESC, al.id DESC
        LIMIT $2
      `;
      params = [teamId, safeLimit + 1];
    }

    const logsRes = await query(queryText, params);
    const hasMore = logsRes.rows.length > safeLimit;
    const pageRows = hasMore ? logsRes.rows.slice(0, safeLimit) : logsRes.rows;

    const items = pageRows.map((r) => ({
      id: r.id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      description: r.description,
      details: r.details,
      createdAt: r.created_at,
      actorName: `${r.actor_first_name} ${r.actor_last_name || ''}`.trim(),
    }));

    const lastItem = items.length > 0 ? items[items.length - 1] : null;
    const nextCursor =
      hasMore && lastItem
        ? Buffer.from(
            JSON.stringify({
              createdAt:
                typeof lastItem.createdAt === 'string'
                  ? lastItem.createdAt
                  : new Date(lastItem.createdAt).toISOString(),
              id: lastItem.id,
            })
          ).toString('base64url')
        : null;

    const feedResult = {
      items,
      pagination: {
        limit: safeLimit,
        nextCursor,
        hasMore,
      },
    };

    await CacheService.setActivityFeed(teamId, pageKey, feedResult);
    return feedResult;
  }
}

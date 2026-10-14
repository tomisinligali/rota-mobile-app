import { pool, query } from '../../db/pool';
import { NotificationsService } from '../notifications/notifications.service';
import { CacheService } from '../../lib/cache';

export interface RequestSwapInput {
  shiftId: string;
  type: 'DIRECT_SWAP' | 'OPEN_SHIFT';
  targetUserId?: string;
  reason?: string;
}

export class SwapsService {
  static async requestSwap(
    requesterId: string,
    teamId: string,
    input: RequestSwapInput
  ) {
    const { shiftId, type, targetUserId, reason } = input;

    if (!['DIRECT_SWAP', 'OPEN_SHIFT'].includes(type)) {
      const err: any = new Error('Invalid swap type specified');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    if (type === 'DIRECT_SWAP' && !targetUserId) {
      const err: any = new Error('A target recipient is required for direct shift swaps');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    if (type === 'DIRECT_SWAP' && targetUserId === requesterId) {
      const err: any = new Error('Cannot swap a shift with yourself');
      err.code = 'VALIDATION_ERROR';
      err.status = 400;
      throw err;
    }

    // Verify shift exists, belongs to team, not cancelled
    const shiftRes = await query(
      `SELECT id, team_id, assigned_to_id, start_time, end_time, status, role_name
       FROM shifts WHERE id = $1 AND team_id = $2`,
      [shiftId, teamId]
    );

    if (shiftRes.rowCount === 0) {
      const err: any = new Error('Shift not found in this team');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const shift = shiftRes.rows[0];

    if (shift.status === 'CANCELLED') {
      const err: any = new Error('Cannot swap a cancelled shift');
      err.code = 'INVALID_SHIFT_STATE';
      err.status = 400;
      throw err;
    }

    if (shift.assigned_to_id !== requesterId) {
      const err: any = new Error('You can only request swaps for shifts assigned to you');
      err.code = 'FORBIDDEN';
      err.status = 403;
      throw err;
    }

    // Started shifts cannot be swapped per PRD Section 5.4.6
    if (new Date(shift.start_time) <= new Date()) {
      const err: any = new Error('Cannot swap a shift that has already started');
      err.code = 'SHIFT_ALREADY_STARTED';
      err.status = 400;
      throw err;
    }

    // Target member check
    if (targetUserId) {
      const targetMemberRes = await query(
        `SELECT id FROM team_memberships WHERE user_id = $1 AND team_id = $2 AND status = 'ACTIVE'`,
        [targetUserId, teamId]
      );
      if (targetMemberRes.rowCount === 0) {
        const err: any = new Error('Proposed recipient is not an active team member');
        err.code = 'INVALID_RECIPIENT';
        err.status = 400;
        throw err;
      }
    }

    // Check no duplicate pending swap
    const existingSwapRes = await query(
      `SELECT id FROM shift_swaps WHERE shift_id = $1 AND status = 'REQUESTED'`,
      [shiftId]
    );

    if (existingSwapRes.rowCount && existingSwapRes.rowCount > 0) {
      const err: any = new Error('A swap request is already pending for this shift');
      err.code = 'DUPLICATE_SWAP_REQUEST';
      err.status = 409;
      throw err;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const swapRes = await client.query(
        `INSERT INTO shift_swaps (team_id, shift_id, requester_id, target_user_id, type, status, reason)
         VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6)
         RETURNING id, team_id, shift_id, requester_id, target_user_id, type, status, reason, requested_at`,
        [teamId, shiftId, requesterId, targetUserId || null, type, reason || null]
      );
      const swap = swapRes.rows[0];

      // Audit log
      await client.query(
        `INSERT INTO activity_logs (team_id, actor_id, entity_type, entity_id, action, description, details)
         VALUES ($1, $2, 'SWAP', $3, 'SWAP_REQUESTED', $4, $5)`,
        [
          teamId,
          requesterId,
          swap.id,
          `Requested ${type === 'DIRECT_SWAP' ? 'direct swap' : 'open shift release'} for shift`,
          JSON.stringify({ shiftId, type, targetUserId }),
        ]
      );

      if (targetUserId) {
        await NotificationsService.createNotification(
          {
            userId: targetUserId,
            teamId,
            type: 'SWAP_REQUESTED',
            title: 'Shift Swap Proposed',
            body: 'A colleague proposed a direct shift swap with you.',
            data: { swapId: swap.id, shiftId },
          },
          client
        );
      }

      await client.query('COMMIT');

      return {
        id: swap.id,
        teamId: swap.team_id,
        shiftId: swap.shift_id,
        requesterId: swap.requester_id,
        targetUserId: swap.target_user_id,
        type: swap.type,
        status: swap.status,
        reason: swap.reason,
        requestedAt: swap.requested_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async claimOpenShift(userId: string, teamId: string, swapId: string) {
    const swapRes = await query(
      `SELECT s.*, sh.start_time, sh.end_time 
       FROM shift_swaps s
       JOIN shifts sh ON sh.id = s.shift_id
       WHERE s.id = $1 AND s.team_id = $2 AND s.status = 'REQUESTED'`,
      [swapId, teamId]
    );

    if (swapRes.rowCount === 0) {
      const err: any = new Error('Open shift swap request not found or not available');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const swap = swapRes.rows[0];

    if (swap.type !== 'OPEN_SHIFT') {
      const err: any = new Error('Only open shift requests can be claimed');
      err.code = 'INVALID_SWAP_TYPE';
      err.status = 400;
      throw err;
    }

    if (swap.requester_id === userId) {
      const err: any = new Error('You cannot claim your own offered shift');
      err.code = 'FORBIDDEN';
      err.status = 400;
      throw err;
    }

    // Recheck overlap for claimant
    const overlapRes = await query(
      `SELECT id FROM shifts
       WHERE assigned_to_id = $1 
         AND status != 'CANCELLED'
         AND start_time < $2 
         AND end_time > $3
       LIMIT 1`,
      [userId, swap.end_time, swap.start_time]
    );

    if (overlapRes.rowCount && overlapRes.rowCount > 0) {
      const err: any = new Error('You already have an overlapping shift during this time.');
      err.code = 'SHIFT_CONFLICT';
      err.status = 409;
      throw err;
    }

    await query(
      `UPDATE shift_swaps SET target_user_id = $1, updated_at = NOW() WHERE id = $2`,
      [userId, swapId]
    );

    return {
      swapId,
      targetUserId: userId,
      status: 'REQUESTED',
    };
  }

  static async approveSwap(approverId: string, teamId: string, swapId: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Atomic Lock on Swap
      const swapRes = await client.query(
        `SELECT sw.*, sh.start_time, sh.end_time, sh.status as shift_status, sh.role_name
         FROM shift_swaps sw
         JOIN shifts sh ON sh.id = sw.shift_id
         WHERE sw.id = $1 AND sw.team_id = $2
         FOR UPDATE`,
        [swapId, teamId]
      );

      if (swapRes.rowCount === 0) {
        const err: any = new Error('Swap request not found');
        err.code = 'NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const swap = swapRes.rows[0];

      if (swap.status !== 'REQUESTED') {
        const err: any = new Error(`Swap request is already ${swap.status.toLowerCase()}`);
        err.code = 'INVALID_SWAP_STATE';
        err.status = 400;
        throw err;
      }

      if (!swap.target_user_id) {
        const err: any = new Error('Cannot approve an open shift swap before a team member has claimed it');
        err.code = 'NO_CLAIMANT';
        err.status = 400;
        throw err;
      }

      if (swap.shift_status === 'CANCELLED') {
        const err: any = new Error('The underlying shift has been cancelled');
        err.code = 'SHIFT_CANCELLED';
        err.status = 400;
        throw err;
      }

      // Check shift has not started
      if (new Date(swap.start_time) <= new Date()) {
        const err: any = new Error('The shift has already started and can no longer be swapped');
        err.code = 'SHIFT_ALREADY_STARTED';
        err.status = 400;
        throw err;
      }

      // Revalidate recipient eligibility
      const targetMemberRes = await client.query(
        `SELECT id, role FROM team_memberships WHERE user_id = $1 AND team_id = $2 AND status = 'ACTIVE'`,
        [swap.target_user_id, teamId]
      );

      if (targetMemberRes.rowCount === 0) {
        const err: any = new Error('The replacement staff member is no longer an active team member');
        err.code = 'INELIGIBLE_RECIPIENT';
        err.status = 400;
        throw err;
      }

      // Revalidate overlap conflict for target recipient
      const overlapRes = await client.query(
        `SELECT id FROM shifts
         WHERE assigned_to_id = $1 
           AND id != $2
           AND status != 'CANCELLED'
           AND start_time < $3 
           AND end_time > $4
         LIMIT 1`,
        [swap.target_user_id, swap.shift_id, swap.end_time, swap.start_time]
      );

      if (overlapRes.rowCount && overlapRes.rowCount > 0) {
        const err: any = new Error('Approval blocked: replacement staff member has an overlapping shift.');
        err.code = 'SHIFT_CONFLICT';
        err.status = 409;
        throw err;
      }

      // Atomically execute shift assignment change
      await client.query(
        `UPDATE shifts 
         SET assigned_to_id = $1, modified_by_id = $2, updated_at = NOW() 
         WHERE id = $3`,
        [swap.target_user_id, approverId, swap.shift_id]
      );

      // Set swap to EXECUTED atomically
      await client.query(
        `UPDATE shift_swaps 
         SET status = 'EXECUTED', approved_by_id = $1, approved_at = NOW(), executed_at = NOW(), updated_at = NOW()
         WHERE id = $2`,
        [approverId, swapId]
      );

      // Audit log
      await client.query(
        `INSERT INTO activity_logs (team_id, actor_id, entity_type, entity_id, action, description, details)
         VALUES ($1, $2, 'SWAP', $3, 'SWAP_APPROVED', $4, $5)`,
        [
          teamId,
          approverId,
          swapId,
          `Approved shift swap for ${swap.role_name || 'shift'}`,
          JSON.stringify({ shiftId: swap.shift_id, newAssigneeId: swap.target_user_id }),
        ]
      );

      // Notify requester
      await NotificationsService.createNotification(
        {
          userId: swap.requester_id,
          teamId,
          type: 'SWAP_APPROVED',
          title: 'Shift Swap Approved',
          body: `Your shift swap for ${swap.role_name || 'shift'} was approved by your manager.`,
          data: { swapId, shiftId: swap.shift_id },
        },
        client
      );

      // Notify new assignee
      if (swap.target_user_id) {
        await NotificationsService.createNotification(
          {
            userId: swap.target_user_id,
            teamId,
            type: 'SWAP_APPROVED',
            title: 'New Shift Assigned',
            body: `You are now assigned to the swapped ${swap.role_name || 'shift'}.`,
            data: { swapId, shiftId: swap.shift_id },
          },
          client
        );
      }

      await client.query('COMMIT');
      await CacheService.invalidateTeamSchedule(teamId);

      return {
        swapId,
        status: 'EXECUTED',
        assignedToId: swap.target_user_id,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async rejectSwap(approverId: string, teamId: string, swapId: string, reason?: string) {
    const swapRes = await query(
      `SELECT id, shift_id, requester_id, status FROM shift_swaps WHERE id = $1 AND team_id = $2`,
      [swapId, teamId]
    );

    if (swapRes.rowCount === 0) {
      const err: any = new Error('Swap request not found');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }

    if (swapRes.rows[0].status !== 'REQUESTED') {
      const err: any = new Error(`Swap request is already ${swapRes.rows[0].status.toLowerCase()}`);
      err.code = 'INVALID_SWAP_STATE';
      err.status = 400;
      throw err;
    }

    await query(
      `UPDATE shift_swaps 
       SET status = 'REJECTED', approved_by_id = $1, rejected_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [approverId, swapId]
    );

    await query(
      `INSERT INTO activity_logs (team_id, actor_id, entity_type, entity_id, action, description, details)
       VALUES ($1, $2, 'SWAP', $3, 'SWAP_REJECTED', $4, $5)`,
      [teamId, approverId, swapId, 'Rejected shift swap request', JSON.stringify({ reason })]
    );

    await NotificationsService.createNotification({
      userId: swapRes.rows[0].requester_id,
      teamId,
      type: 'SWAP_REJECTED',
      title: 'Shift Swap Declined',
      body: 'Your shift swap request was declined by your manager.',
      data: { swapId, shiftId: swapRes.rows[0].shift_id },
    });

    return { swapId, status: 'REJECTED' };
  }

  static async getTeamSwaps(teamId: string, status?: string) {
    let queryText = `
      SELECT sw.id, sw.team_id, sw.shift_id, sw.requester_id, sw.target_user_id,
             sw.type, sw.status, sw.reason, sw.requested_at, sw.approved_at,
             sh.role_name, sh.start_time, sh.end_time,
             req.first_name as requester_first_name, req.last_name as requester_last_name, req.email as requester_email,
             tgt.first_name as target_first_name, tgt.last_name as target_last_name, tgt.email as target_email
      FROM shift_swaps sw
      JOIN shifts sh ON sh.id = sw.shift_id
      JOIN users req ON req.id = sw.requester_id
      LEFT JOIN users tgt ON tgt.id = sw.target_user_id
      WHERE sw.team_id = $1
    `;
    const params: unknown[] = [teamId];

    if (status) {
      params.push(status);
      queryText += ` AND sw.status = $${params.length}`;
    }

    queryText += ` ORDER BY sw.requested_at DESC`;

    const res = await query(queryText, params);
    return res.rows.map((r) => ({
      id: r.id,
      shiftId: r.shift_id,
      type: r.type,
      status: r.status,
      reason: r.reason,
      requestedAt: r.requested_at,
      shift: {
        roleName: r.role_name,
        startTime: r.start_time,
        endTime: r.end_time,
      },
      requester: {
        id: r.requester_id,
        name: `${r.requester_first_name} ${r.requester_last_name || ''}`.trim(),
        email: r.requester_email,
      },
      targetUser: r.target_user_id
        ? {
            id: r.target_user_id,
            name: `${r.target_first_name} ${r.target_last_name || ''}`.trim(),
            email: r.target_email,
          }
        : null,
    }));
  }
}

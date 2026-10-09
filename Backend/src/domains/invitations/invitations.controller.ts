import { Request, Response } from 'express';
import { InvitationsService } from './invitations.service';
import { Role } from '../../middleware/rbac';

export class InvitationsController {
  static async createInvitation(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const teamId = String(req.params.teamId);
      const { email, role, expiresInDays } = req.body;

      const invitation = await InvitationsService.createInvitation(user.id, teamId, {
        email,
        role: role as Role,
        expiresInDays,
      });

      res.status(201).json({
        data: invitation,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to create invitation',
          details: {},
        },
      });
    }
  }

  static async verifyInvitation(req: Request, res: Response): Promise<void> {
    try {
      const token = String(req.params.token);
      const details = await InvitationsService.verifyInvitation(token);
      res.status(200).json({
        data: details,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to verify invitation',
          details: {},
        },
      });
    }
  }

  static async acceptInvitation(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const token = String(req.params.token);

      const result = await InvitationsService.acceptInvitation(user.id, token);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to accept invitation',
          details: {},
        },
      });
    }
  }

  static async getTeamInvitations(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const invitations = await InvitationsService.getTeamInvitations(teamId);
      res.status(200).json({
        data: invitations,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve team invitations',
          details: {},
        },
      });
    }
  }

  static async revokeInvitation(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const invitationId = String(req.params.invitationId);
      const result = await InvitationsService.revokeInvitation(teamId, invitationId);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to revoke invitation',
          details: {},
        },
      });
    }
  }
}

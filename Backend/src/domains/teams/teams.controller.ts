import { Request, Response } from 'express';
import { TeamsService } from './teams.service';
import { Role } from '../../middleware/rbac';

export class TeamsController {
  static async createTeam(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const { name, businessName, timezone } = req.body;
      const team = await TeamsService.createTeam(user.id, { name, businessName, timezone });
      res.status(201).json({
        data: team,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to create team',
          details: {},
        },
      });
    }
  }

  static async getUserTeams(req: Request, res: Response): Promise<void> {
    try {
      const user = req.user!;
      const teams = await TeamsService.getUserTeams(user.id);
      res.status(200).json({
        data: teams,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve teams',
          details: {},
        },
      });
    }
  }

  static async getTeamDetails(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const team = await TeamsService.getTeamDetails(teamId);
      res.status(200).json({
        data: team,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to retrieve team details',
          details: {},
        },
      });
    }
  }

  static async getTeamMembers(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const members = await TeamsService.getTeamMembers(teamId);
      res.status(200).json({
        data: members,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to retrieve team members',
          details: {},
        },
      });
    }
  }

  static async updateMemberRole(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const memberId = String(req.params.memberId);
      const { role } = req.body;
      const actorRole = req.teamContext!.role;

      const result = await TeamsService.updateMemberRole(actorRole, teamId, memberId, role as Role);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to update member role',
          details: {},
        },
      });
    }
  }

  static async deactivateMember(req: Request, res: Response): Promise<void> {
    try {
      const teamId = String(req.params.teamId);
      const memberId = String(req.params.memberId);
      const actorRole = req.teamContext!.role;

      const result = await TeamsService.deactivateMember(actorRole, teamId, memberId);
      res.status(200).json({
        data: result,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (err: any) {
      res.status(err.status || 500).json({
        error: {
          code: err.code || 'INTERNAL_SERVER_ERROR',
          message: err.message || 'Failed to deactivate member',
          details: {},
        },
      });
    }
  }
}

import { z } from 'zod';

// ==========================================
// AUTH SCHEMAS
// ==========================================
export const registerSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(64, 'Password must not exceed 64 characters'),
  firstName: z.string().trim().min(1, 'First name is required'),
  lastName: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  code: z.string().trim().length(6, 'Verification code must be exactly 6 digits'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .max(64, 'Password must not exceed 64 characters'),
});

export const verifyEmailSchema = z.object({
  code: z.string().trim().min(1, 'Verification code is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().optional(),
});

// ==========================================
// TEAMS SCHEMAS
// ==========================================
export const createTeamSchema = z.object({
  name: z.string().trim().min(1, 'Team name is required'),
  businessName: z.string().trim().optional(),
  timezone: z.string().trim().optional(),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'MANAGER', 'STAFF'], {
    message: 'Role must be OWNER, MANAGER, or STAFF',
  }),
});

// ==========================================
// SHIFTS SCHEMAS
// ==========================================
export const createShiftSchema = z.object({
  roleName: z.string().trim().min(1, 'Role name is required'),
  startTime: z.string().datetime({ message: 'Start time must be a valid ISO 8601 datetime' }),
  endTime: z.string().datetime({ message: 'End time must be a valid ISO 8601 datetime' }),
  assignedToId: z.string().uuid('Assigned user ID must be a valid UUID').nullable().optional(),
  notes: z.string().optional().nullable(),
});

export const updateShiftSchema = z.object({
  roleName: z.string().trim().min(1).optional(),
  startTime: z.string().datetime({ message: 'Start time must be a valid ISO 8601 datetime' }).optional(),
  endTime: z.string().datetime({ message: 'End time must be a valid ISO 8601 datetime' }).optional(),
  assignedToId: z.string().uuid('Assigned user ID must be a valid UUID').nullable().optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED']).optional(),
  notes: z.string().optional().nullable(),
});

// ==========================================
// SWAPS SCHEMAS
// ==========================================
export const createSwapSchema = z.object({
  shiftId: z.string().uuid('Shift ID must be a valid UUID'),
  targetUserId: z.string().uuid('Target user ID must be a valid UUID').optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const rejectSwapSchema = z.object({
  reason: z.string().optional(),
});

// ==========================================
// INVITATIONS SCHEMAS
// ==========================================
export const createInvitationSchema = z.object({
  email: z.string().trim().email('Invalid email address').optional().nullable(),
  role: z.enum(['OWNER', 'MANAGER', 'STAFF']).default('STAFF').optional(),
  expiresInDays: z.number().int().positive().max(30).default(7).optional(),
});

// ==========================================
// BILLING SCHEMAS
// ==========================================
export const updateSubscriptionSchema = z.object({
  seats: z.number().int().min(0, 'Seats must be a non-negative integer'),
  billingCycle: z.enum(['MONTHLY', 'ANNUAL']).default('MONTHLY'),
});

export const previewProrationSchema = z.object({
  newSeats: z.number().int().min(0, 'New seats must be a non-negative integer'),
});

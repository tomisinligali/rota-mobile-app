import { query } from '../../db/pool';

export interface UserSettingsInput {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  shiftReminders?: boolean;
  swapAlerts?: boolean;
  notifyShiftChanges?: boolean;
  notifySwaps?: boolean;
  notifyBilling?: boolean;
  quietHoursEnabled?: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
  language?: string;
  autoSyncOffline?: boolean;
  startDayOfWeek?: number;
  theme?: string;
}

export class UsersService {
  static async getSettings(userId: string) {
    const res = await query(
      `SELECT user_id, email_notifications, push_notifications, shift_reminders,
              swap_alerts, notify_shift_changes, notify_swaps, notify_billing,
              quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone,
              language, auto_sync_offline, start_day_of_week, theme, updated_at
       FROM user_settings
       WHERE user_id = $1`,
      [userId]
    );

    if (res.rowCount === 0) {
      // Create defaults
      const insertRes = await query(
        `INSERT INTO user_settings (user_id) VALUES ($1)
         RETURNING user_id, email_notifications, push_notifications, shift_reminders,
                   swap_alerts, notify_shift_changes, notify_swaps, notify_billing,
                   quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone,
                   language, auto_sync_offline, start_day_of_week, theme, updated_at`,
        [userId]
      );
      return this.formatSettings(insertRes.rows[0]);
    }

    return this.formatSettings(res.rows[0]);
  }

  static async updateSettings(userId: string, input: UserSettingsInput) {
    const current = await this.getSettings(userId);

    // Validate quiet hours time format (HH:mm in 24h format)
    if (input.quietHoursStart !== undefined && input.quietHoursStart !== null) {
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(input.quietHoursStart)) {
        const err: any = new Error('Invalid quiet hours start format. Expected HH:mm in 24-hour format (e.g. "22:00").');
        err.code = 'VALIDATION_ERROR';
        err.status = 400;
        throw err;
      }
    }

    if (input.quietHoursEnd !== undefined && input.quietHoursEnd !== null) {
      if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(input.quietHoursEnd)) {
        const err: any = new Error('Invalid quiet hours end format. Expected HH:mm in 24-hour format (e.g. "06:00").');
        err.code = 'VALIDATION_ERROR';
        err.status = 400;
        throw err;
      }
    }

    // Validate timezone string against IANA format
    if (input.timezone !== undefined && input.timezone !== null) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: input.timezone.trim() });
      } catch {
        const err: any = new Error(`Invalid timezone "${input.timezone}". Expected a valid IANA timezone identifier (e.g. "Europe/London", "Africa/Lagos", "America/New_York").`);
        err.code = 'VALIDATION_ERROR';
        err.status = 400;
        throw err;
      }
    }

    // Validate language code
    if (input.language !== undefined && input.language !== null) {
      const langTrimmed = input.language.trim().toLowerCase();
      if (!/^[a-z]{2}(-[a-z]{2,4})?$/.test(langTrimmed)) {
        const err: any = new Error(`Invalid language code "${input.language}". Expected 2-letter language code (e.g. "en", "es", "fr", "de").`);
        err.code = 'VALIDATION_ERROR';
        err.status = 400;
        throw err;
      }
    }

    // Validate theme option
    if (input.theme !== undefined && input.theme !== null) {
      const themeUpper = input.theme.trim().toUpperCase();
      if (!['SYSTEM', 'LIGHT', 'DARK'].includes(themeUpper)) {
        const err: any = new Error(`Invalid theme "${input.theme}". Supported themes are: SYSTEM, LIGHT, DARK.`);
        err.code = 'VALIDATION_ERROR';
        err.status = 400;
        throw err;
      }
    }

    const emailNotifications = input.emailNotifications ?? current.emailNotifications;
    const pushNotifications = input.pushNotifications ?? current.pushNotifications;
    const shiftReminders = input.shiftReminders ?? current.shiftReminders;
    const swapAlerts = input.swapAlerts ?? current.swapAlerts;
    const notifyShiftChanges = input.notifyShiftChanges ?? current.notifyShiftChanges;
    const notifySwaps = input.notifySwaps ?? current.notifySwaps;
    const notifyBilling = input.notifyBilling ?? current.notifyBilling;
    const quietHoursEnabled = input.quietHoursEnabled ?? current.quietHoursEnabled;
    const quietHoursStart = input.quietHoursStart ? input.quietHoursStart.trim() : current.quietHoursStart;
    const quietHoursEnd = input.quietHoursEnd ? input.quietHoursEnd.trim() : current.quietHoursEnd;
    const timezone = input.timezone ? input.timezone.trim() : current.timezone;
    const language = input.language ? input.language.trim().toLowerCase() : current.language;
    const autoSyncOffline = input.autoSyncOffline ?? current.autoSyncOffline;
    const startDayOfWeek = input.startDayOfWeek ?? current.startDayOfWeek;
    const theme = input.theme ? input.theme.trim().toUpperCase() : current.theme;

    // Last-Write-Wins (LWW): Server sets updated_at = NOW()
    const res = await query(
      `INSERT INTO user_settings 
        (user_id, email_notifications, push_notifications, shift_reminders, swap_alerts,
         notify_shift_changes, notify_swaps, notify_billing,
         quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone,
         language, auto_sync_offline, start_day_of_week, theme, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         email_notifications = $2,
         push_notifications = $3,
         shift_reminders = $4,
         swap_alerts = $5,
         notify_shift_changes = $6,
         notify_swaps = $7,
         notify_billing = $8,
         quiet_hours_enabled = $9,
         quiet_hours_start = $10,
         quiet_hours_end = $11,
         timezone = $12,
         language = $13,
         auto_sync_offline = $14,
         start_day_of_week = $15,
         theme = $16,
         updated_at = NOW()
       RETURNING user_id, email_notifications, push_notifications, shift_reminders,
                 swap_alerts, notify_shift_changes, notify_swaps, notify_billing,
                 quiet_hours_enabled, quiet_hours_start, quiet_hours_end, timezone,
                 language, auto_sync_offline, start_day_of_week, theme, updated_at`,
      [
        userId,
        emailNotifications,
        pushNotifications,
        shiftReminders,
        swapAlerts,
        notifyShiftChanges,
        notifySwaps,
        notifyBilling,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
        timezone,
        language,
        autoSyncOffline,
        startDayOfWeek,
        theme,
      ]
    );

    return this.formatSettings(res.rows[0]);
  }

  private static formatSettings(row: any) {
    return {
      userId: row.user_id,
      emailNotifications: row.email_notifications,
      pushNotifications: row.push_notifications,
      shiftReminders: row.shift_reminders,
      swapAlerts: row.swap_alerts,
      notifyShiftChanges: row.notify_shift_changes,
      notifySwaps: row.notify_swaps,
      notifyBilling: row.notify_billing,
      quietHoursEnabled: row.quiet_hours_enabled,
      quietHoursStart: row.quiet_hours_start || '22:00',
      quietHoursEnd: row.quiet_hours_end || '08:00',
      timezone: row.timezone || 'UTC',
      language: row.language || 'en',
      autoSyncOffline: row.auto_sync_offline,
      startDayOfWeek: row.start_day_of_week,
      theme: row.theme || 'SYSTEM',
      updatedAt: row.updated_at,
    };
  }
}

import { query } from '../../db/pool';

export interface UserSettingsInput {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  shiftReminders?: boolean;
  swapAlerts?: boolean;
  autoSyncOffline?: boolean;
  startDayOfWeek?: number;
  theme?: string;
}

export class UsersService {
  static async getSettings(userId: string) {
    const res = await query(
      `SELECT user_id, email_notifications, push_notifications, shift_reminders,
              swap_alerts, auto_sync_offline, start_day_of_week, theme, updated_at
       FROM user_settings
       WHERE user_id = $1`,
      [userId]
    );

    if (res.rowCount === 0) {
      // Create defaults
      const insertRes = await query(
        `INSERT INTO user_settings (user_id) VALUES ($1)
         RETURNING user_id, email_notifications, push_notifications, shift_reminders,
                   swap_alerts, auto_sync_offline, start_day_of_week, theme, updated_at`,
        [userId]
      );
      return this.formatSettings(insertRes.rows[0]);
    }

    return this.formatSettings(res.rows[0]);
  }

  static async updateSettings(userId: string, input: UserSettingsInput) {
    const current = await this.getSettings(userId);

    const emailNotifications = input.emailNotifications ?? current.emailNotifications;
    const pushNotifications = input.pushNotifications ?? current.pushNotifications;
    const shiftReminders = input.shiftReminders ?? current.shiftReminders;
    const swapAlerts = input.swapAlerts ?? current.swapAlerts;
    const autoSyncOffline = input.autoSyncOffline ?? current.autoSyncOffline;
    const startDayOfWeek = input.startDayOfWeek ?? current.startDayOfWeek;
    const theme = input.theme ?? current.theme;

    const res = await query(
      `INSERT INTO user_settings 
        (user_id, email_notifications, push_notifications, shift_reminders, swap_alerts, auto_sync_offline, start_day_of_week, theme, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         email_notifications = $2,
         push_notifications = $3,
         shift_reminders = $4,
         swap_alerts = $5,
         auto_sync_offline = $6,
         start_day_of_week = $7,
         theme = $8,
         updated_at = NOW()
       RETURNING user_id, email_notifications, push_notifications, shift_reminders,
                 swap_alerts, auto_sync_offline, start_day_of_week, theme, updated_at`,
      [
        userId,
        emailNotifications,
        pushNotifications,
        shiftReminders,
        swapAlerts,
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
      autoSyncOffline: row.auto_sync_offline,
      startDayOfWeek: row.start_day_of_week,
      theme: row.theme,
      updatedAt: row.updated_at,
    };
  }
}

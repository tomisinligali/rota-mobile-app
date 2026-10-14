export interface PushMessagePayload {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

export interface PushSendResult {
  success: boolean;
  sentCount: number;
  invalidTokens: string[];
  error?: string;
}

export class PushService {
  /**
   * Dispatches push notification to Expo's Push API endpoint.
   * Detects invalid/unregistered device tokens so they can be deleted immediately.
   */
  static async sendPushNotification(payload: PushMessagePayload): Promise<PushSendResult> {
    const tokens = Array.isArray(payload.to) ? payload.to : [payload.to];
    const filteredTokens = tokens.filter((t) => typeof t === 'string' && t.trim().length > 0);

    if (filteredTokens.length === 0) {
      return { success: true, sentCount: 0, invalidTokens: [] };
    }

    try {
      const messages = filteredTokens.map((token) => ({
        to: token,
        sound: payload.sound !== undefined ? payload.sound : 'default',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        priority: payload.priority || 'high',
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Expo push service responded with status ${response.status}:`, errorText);
        return {
          success: false,
          sentCount: 0,
          invalidTokens: [],
          error: `HTTP ${response.status}: ${errorText}`,
        };
      }

      const json = await response.json();
      const invalidTokens: string[] = [];
      let sentCount = 0;

      if (json && Array.isArray(json.data)) {
        json.data.forEach((ticket: any, index: number) => {
          const token = filteredTokens[index];
          if (ticket.status === 'ok') {
            sentCount++;
          } else if (ticket.status === 'error') {
            const errCode = ticket.details?.error;
            const errMsg = ticket.message || '';
            // DeviceNotRegistered or InvalidCredentials indicates the token is no longer valid
            if (
              errCode === 'DeviceNotRegistered' ||
              errCode === 'InvalidCredentials' ||
              errMsg.toLowerCase().includes('devicenotregistered') ||
              errMsg.toLowerCase().includes('not a registered push notification recipient')
            ) {
              if (token) {
                invalidTokens.push(token);
              }
            }
          }
        });
      }

      return {
        success: sentCount > 0 || invalidTokens.length > 0,
        sentCount,
        invalidTokens,
      };
    } catch (err: any) {
      console.error('Error dispatching push notification:', err.message);
      return {
        success: false,
        sentCount: 0,
        invalidTokens: [],
        error: err.message,
      };
    }
  }
}

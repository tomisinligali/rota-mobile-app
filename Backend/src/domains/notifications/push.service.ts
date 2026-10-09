export interface PushMessagePayload {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

export class PushService {
  /**
   * Dispatches push notification to Expo's Push API endpoint.
   */
  static async sendPushNotification(payload: PushMessagePayload): Promise<boolean> {
    try {
      const messages = Array.isArray(payload.to)
        ? payload.to.map((token) => ({
            to: token,
            sound: 'default',
            title: payload.title,
            body: payload.body,
            data: payload.data || {},
          }))
        : [
            {
              to: payload.to,
              sound: 'default',
              title: payload.title,
              body: payload.body,
              data: payload.data || {},
            },
          ];

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
        console.warn(`Expo push service responded with status ${response.status}`);
        return false;
      }

      const json = await response.json();
      return json?.data?.[0]?.status === 'ok';
    } catch (err: any) {
      console.error('Error dispatching push notification:', err.message);
      return false;
    }
  }
}

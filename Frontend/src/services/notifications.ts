import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiService } from './api';
import { useUiStore, TabType, ProfileSubTab } from '../store/uiStore';

const DEVICE_ID_KEY = '@rota_device_id';

// Safely resolve native modules so pre-compiled app binaries do not crash
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
  if (Notifications?.setNotificationHandler) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch {
  console.log('[Notifications] Native ExpoPushTokenManager not available in current binary build.');
}

let Device: any = null;
try {
  Device = require('expo-device');
} catch {
  // Ignored
}

/**
 * Returns a persistent unique device identifier for this installation.
 * Ensures the server can link multiple devices to a single user.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      const randomPart = Math.random().toString(36).substring(2, 10);
      deviceId = `${Platform.OS}-${Date.now()}-${randomPart}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return `${Platform.OS}-${Date.now()}`;
  }
}

/**
 * Registers device for push notifications and sends token + deviceId to backend.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const deviceId = await getOrCreateDeviceId();
    const deviceName = Device?.modelName || (Platform.OS === 'ios' ? 'iPhone' : 'Android Device');

    let token: string | null = null;

    if (Platform.OS === 'web') {
      return null;
    }

    if (Notifications && typeof Notifications.getPermissionsAsync === 'function') {
      try {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted' && typeof Notifications.requestPermissionsAsync === 'function') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus === 'granted' && typeof Notifications.getExpoPushTokenAsync === 'function') {
          const tokenResponse = await Notifications.getExpoPushTokenAsync();
          token = tokenResponse?.data || null;
        }
      } catch (err: any) {
        console.warn('[Notifications] Native push token fetch bypassed:', err.message);
      }
    }

    // Fallback device token for development / simulator environments
    if (!token) {
      token = `ExponentPushToken[dev-${deviceId}]`;
    }

    if (token) {
      await ApiService.registerPushToken(token, {
        deviceId,
        deviceType: Platform.OS,
        deviceName,
      });
      console.log('[Notifications] Push token successfully registered on server for device:', deviceId);
    }

    return token;
  } catch (err: any) {
    console.warn('[Notifications] Error registering push notifications:', err.message);
    return null;
  }
}

/**
 * Unregisters the current device's push token on the server (called on logout).
 */
export async function unregisterPushNotificationsAsync(): Promise<void> {
  try {
    const deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (deviceId) {
      await ApiService.unregisterPushToken({ deviceId });
      console.log('[Notifications] Device push token unregistered on server.');
    }
  } catch (err: any) {
    console.warn('[Notifications] Failed to unregister device push token:', err.message);
  }
}

/**
 * Handles deep linking when a user taps a push notification banner.
 * Directs the user immediately to the target screen (shifts, swaps, billing, etc.).
 */
export function handleNotificationDeepLink(data: any) {
  if (!data) return;

  const targetScreen = data.screen as TabType | undefined;
  const targetSubTab = data.subTab as ProfileSubTab | undefined;

  if (targetScreen) {
    useUiStore.getState().setActiveTab(targetScreen);
  }

  if (targetSubTab) {
    useUiStore.getState().setProfileSubTab(targetSubTab);
  }
}

/**
 * Sets up the notification response listener (deep link listener when notification is clicked).
 */
export function setupNotificationListeners(onNavigate?: (data: any) => void) {
  if (Notifications && typeof Notifications.addNotificationResponseReceivedListener === 'function') {
    try {
      const responseSubscription = Notifications.addNotificationResponseReceivedListener((response: any) => {
        const data = response?.notification?.request?.content?.data;
        handleNotificationDeepLink(data);
        if (onNavigate) {
          onNavigate(data);
        }
      });

      return () => {
        responseSubscription?.remove?.();
      };
    } catch {
      // Ignored
    }
  }

  return () => {};
}

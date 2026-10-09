import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'rota_auth_session_token';
const SHIFTS_CACHE_KEY = 'rota_offline_shifts_cache';
const SETTINGS_CACHE_KEY = 'rota_user_settings_cache';

// In-memory fallback if SecureStore is unavailable in certain environments
let inMemoryToken: string | null = null;
let inMemoryShifts: any[] = [];
let inMemorySettings: any = null;

export const StorageService = {
  async setToken(token: string): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
      }
    } catch {
      inMemoryToken = token;
    }
  },

  async getToken(): Promise<string | null> {
    try {
      if (Platform.OS === 'web') {
        return localStorage.getItem(TOKEN_KEY);
      }
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch {
      return inMemoryToken;
    }
  },

  async clearToken(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        localStorage.removeItem(TOKEN_KEY);
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }
    } catch {
      inMemoryToken = null;
    }
  },

  /**
   * Persists user's upcoming shifts for offline viewing.
   */
  async cacheUpcomingShifts(shifts: any[]): Promise<void> {
    inMemoryShifts = shifts;
    try {
      const dataStr = JSON.stringify(shifts);
      if (Platform.OS === 'web') {
        localStorage.setItem(SHIFTS_CACHE_KEY, dataStr);
      } else {
        await SecureStore.setItemAsync(SHIFTS_CACHE_KEY, dataStr);
      }
    } catch {
      // In-memory copy preserved
    }
  },

  /**
   * Retrieves cached upcoming shifts for offline access.
   */
  async getCachedUpcomingShifts(): Promise<any[]> {
    try {
      let raw: string | null = null;
      if (Platform.OS === 'web') {
        raw = localStorage.getItem(SHIFTS_CACHE_KEY);
      } else {
        raw = await SecureStore.getItemAsync(SHIFTS_CACHE_KEY);
      }
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Fallback to in-memory
    }
    return inMemoryShifts || [];
  },

  /**
   * Persists synced user settings.
   */
  async cacheUserSettings(settings: any): Promise<void> {
    inMemorySettings = settings;
    try {
      const dataStr = JSON.stringify(settings);
      if (Platform.OS === 'web') {
        localStorage.setItem(SETTINGS_CACHE_KEY, dataStr);
      } else {
        await SecureStore.setItemAsync(SETTINGS_CACHE_KEY, dataStr);
      }
    } catch {
      // Preserved in memory
    }
  },

  /**
   * Retrieves cached user settings.
   */
  async getCachedUserSettings(): Promise<any | null> {
    try {
      let raw: string | null = null;
      if (Platform.OS === 'web') {
        raw = localStorage.getItem(SETTINGS_CACHE_KEY);
      } else {
        raw = await SecureStore.getItemAsync(SETTINGS_CACHE_KEY);
      }
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Fallback
    }
    return inMemorySettings;
  },
};

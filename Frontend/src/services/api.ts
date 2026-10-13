import { StorageService } from './storage';
import { Platform } from 'react-native';

// Base API configuration from environment
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.API_URL ||
  (Platform.OS === 'web' ? 'http://localhost:5001/api/v1' : 'http://192.168.100.84:5001/api/v1');

// Server origin for non-versioned endpoints like /health
const SERVER_ORIGIN = BASE_URL.replace('/api/v1', '');

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await StorageService.getRefreshToken();
      if (!refreshToken) {
        await StorageService.clearTokens();
        return null;
      }

      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.data?.accessToken) {
        await StorageService.clearTokens();
        return null;
      }

      const { accessToken, refreshToken: newRefreshToken } = json.data;
      await StorageService.setTokens({ accessToken, refreshToken: newRefreshToken });
      return accessToken;
    } catch {
      await StorageService.clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = await StorageService.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Transparent token refresh on expired access token or 401 if a refresh token is present
    const isAuthEndpoint =
      path.includes('/auth/login') ||
      path.includes('/auth/register') ||
      path.includes('/auth/refresh') ||
      path.includes('/auth/forgot-password') ||
      path.includes('/auth/reset-password');

    if (response.status === 401 && !isRetry && !isAuthEndpoint && token) {
      const newAccessToken = await refreshAccessToken();
      if (newAccessToken) {
        return await request<T>(path, options, true);
      }
    }

    const error: ApiError = json.error || {
      code: 'HTTP_ERROR',
      message: `Request failed with status ${response.status}`,
    };
    throw error;
  }

  return json.data as T;
}

export const ApiService = {
  getBaseUrl(): string {
    return BASE_URL;
  },

  async checkHealth(): Promise<{ status: string; database: string }> {
    const response = await fetch(`${SERVER_ORIGIN}/health`);
    return await response.json();
  },

  async register(
    data: { email: string; password: string; firstName: string; lastName?: string },
    idempotencyKey?: string
  ) {
    const key =
      idempotencyKey ||
      (typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `reg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);

    const res = await request<{ user: any; token: string; accessToken?: string; refreshToken?: string }>(
      '/auth/register',
      {
        method: 'POST',
        headers: {
          'Idempotency-Key': key,
        },
        body: JSON.stringify(data),
      }
    );
    const accessToken = res?.accessToken || res?.token;
    if (accessToken) {
      await StorageService.setTokens({
        accessToken,
        refreshToken: res.refreshToken,
      });
    }
    return res;
  },

  async login(data: { email: string; password: string }) {
    const res = await request<{ user: any; token: string; accessToken?: string; refreshToken?: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    const accessToken = res?.accessToken || res?.token;
    if (accessToken) {
      await StorageService.setTokens({
        accessToken,
        refreshToken: res.refreshToken,
      });
    }
    return res;
  },

  async googleLogin(idToken: string) {
    const res = await request<{ user: any; token: string; accessToken?: string; refreshToken?: string }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    const accessToken = res?.accessToken || res?.token;
    if (accessToken) {
      await StorageService.setTokens({
        accessToken,
        refreshToken: res.refreshToken,
      });
    }
    return res;
  },

  /**
   * Confirms the signed-in user's email using the 6-digit code from the
   * verification email. Requires the session token from register/login.
   */
  async verifyEmail(code: string): Promise<{ emailVerified: boolean }> {
    return await request<{ emailVerified: boolean }>('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },

  async resendVerification(): Promise<{ sent?: boolean; alreadyVerified?: boolean }> {
    return await request<{ sent?: boolean; alreadyVerified?: boolean }>(
      '/auth/resend-verification',
      { method: 'POST' }
    );
  },

  async forgotPassword(email: string): Promise<{ message: string }> {
    return await request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async verifyResetCode(
    email: string,
    code: string
  ): Promise<{ valid: boolean }> {
    return await request<{ valid: boolean }>('/auth/verify-reset-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  },

  async resetPassword(
    email: string,
    code: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    return await request<{ success: boolean; message: string }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, code, newPassword }),
    });
  },

  async logout(): Promise<void> {
    const refreshToken = await StorageService.getRefreshToken();
    try {
      await request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore network errors during logout
    } finally {
      await StorageService.clearTokens();
    }
  },

  async logoutAll(): Promise<void> {
    try {
      await request('/auth/logout-all', {
        method: 'POST',
      });
    } finally {
      await StorageService.clearTokens();
    }
  },

  async getMe(): Promise<{ user: any }> {
    return await request<{ user: any }>('/auth/me');
  },

  async getDashboardSummary(): Promise<any> {
    return await request<any>('/dashboard/summary');
  },

  async getTeams(): Promise<any[]> {
    return await request<any[]>('/teams');
  },

  async createTeam(data: { name: string; businessName?: string; timezone?: string }): Promise<any> {
    return await request<any>('/teams', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getTeamMembers(teamId: string): Promise<any[]> {
    return await request<any[]>(`/teams/${teamId}/members`);
  },

  async createInvitation(
    teamId: string,
    data: { email?: string; role?: 'MANAGER' | 'STAFF'; expiresInDays?: number }
  ): Promise<any> {
    return await request<any>(`/invitations/teams/${teamId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async verifyInvitation(token: string): Promise<any> {
    const response = await fetch(`${BASE_URL}/invitations/verify/${token}`);
    const json = await response.json();
    if (!response.ok) throw json.error;
    return json.data;
  },

  async acceptInvitation(token: string): Promise<any> {
    return await request<any>(`/invitations/accept/${token}`, {
      method: 'POST',
    });
  },

  async updateMemberRole(teamId: string, memberId: string, role: string): Promise<any> {
    return await request<any>(`/teams/${teamId}/members/${memberId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  },

  async deactivateMember(teamId: string, memberId: string): Promise<any> {
    return await request<any>(`/teams/${teamId}/members/${memberId}`, {
      method: 'DELETE',
    });
  },

  async getShifts(
    teamId: string,
    params?: { start?: string; end?: string; assignedToId?: string }
  ): Promise<any[]> {
    const searchParams = new URLSearchParams();
    if (params?.start) searchParams.append('start', params.start);
    if (params?.end) searchParams.append('end', params.end);
    if (params?.assignedToId) searchParams.append('assignedToId', params.assignedToId);
    const qs = searchParams.toString();
    return await request<any[]>(`/shifts/teams/${teamId}${qs ? `?${qs}` : ''}`);
  },

  async createShift(
    teamId: string,
    data: { assignedToId?: string; roleName?: string; startTime: string; endTime: string; notes?: string }
  ): Promise<any> {
    return await request<any>(`/shifts/teams/${teamId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateShift(
    teamId: string,
    shiftId: string,
    data: any
  ): Promise<any> {
    return await request<any>(`/shifts/teams/${teamId}/${shiftId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async cancelShift(teamId: string, shiftId: string): Promise<any> {
    return await request<any>(`/shifts/teams/${teamId}/${shiftId}`, {
      method: 'DELETE',
    });
  },

  async getActivityFeed(
    teamId: string,
    limit: number = 20,
    cursor?: string | null
  ): Promise<{ items: any[]; pagination: any }> {
    const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
    const res = await fetch(`${BASE_URL}/shifts/teams/${teamId}/activity?limit=${limit}${cursorParam}`, {
      headers: {
        Authorization: `Bearer ${await StorageService.getToken()}`,
      },
    });
    const json = await responseOrError(res);
    return {
      items: json.data,
      pagination: json.meta,
    };
  },

  async getTeamSwaps(teamId: string, status?: string): Promise<any[]> {
    const qs = status ? `?status=${status}` : '';
    return await request<any[]>(`/swaps/teams/${teamId}${qs}`);
  },

  async requestSwap(
    teamId: string,
    data: { shiftId: string; type: 'DIRECT_SWAP' | 'OPEN_SHIFT'; targetUserId?: string; reason?: string }
  ): Promise<any> {
    return await request<any>(`/swaps/teams/${teamId}/request`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async claimOpenShift(teamId: string, swapId: string): Promise<any> {
    return await request<any>(`/swaps/teams/${teamId}/claim/${swapId}`, {
      method: 'POST',
    });
  },

  async approveSwap(teamId: string, swapId: string): Promise<any> {
    return await request<any>(`/swaps/teams/${teamId}/approve/${swapId}`, {
      method: 'POST',
    });
  },

  async rejectSwap(teamId: string, swapId: string, reason?: string): Promise<any> {
    return await request<any>(`/swaps/teams/${teamId}/reject/${swapId}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async getSubscription(businessId: string): Promise<any> {
    return await request<any>(`/billing/subscription/${businessId}`);
  },

  async previewProration(
    businessId: string,
    data: { newPlanTier: string; newSeatCount: number }
  ): Promise<any> {
    return await request<any>(`/billing/preview-proration/${businessId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateSubscription(
    businessId: string,
    data: { newPlanTier: string; newSeatCount: number }
  ): Promise<any> {
    return await request<any>(`/billing/update-subscription/${businessId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async initializeCheckout(
    businessId: string,
    data: {
      planTier: 'TEAM' | 'BUSINESS';
      billingCycle: 'monthly' | 'yearly';
      seatCount?: number;
      redirectUrl?: string;
    }
  ): Promise<any> {
    return await request<any>(`/billing/initialize-checkout/${businessId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Notifications
  async getNotifications(limit = 30): Promise<any> {
    const token = await StorageService.getToken();
    const res = await fetch(`${BASE_URL}/notifications?limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const json = await responseOrError(res);
    return {
      items: json.data || [],
      unreadCount: json.meta?.unreadCount || 0,
    };
  },

  async registerPushToken(pushToken: string, deviceType = 'expo'): Promise<any> {
    return await request<any>('/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({ pushToken, deviceType }),
    });
  },

  async markNotificationAsRead(id: string): Promise<any> {
    return await request<any>(`/notifications/${id}/read`, {
      method: 'PATCH',
    });
  },

  async markAllNotificationsAsRead(): Promise<any> {
    return await request<any>('/notifications/read-all', {
      method: 'POST',
    });
  },

  // User Settings
  async getUserSettings(): Promise<any> {
    return await request<any>('/users/settings');
  },

  async updateUserSettings(data: any): Promise<any> {
    return await request<any>('/users/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

export const NotificationsApi = {
  getNotifications: ApiService.getNotifications,
  registerPushToken: ApiService.registerPushToken,
  markNotificationAsRead: ApiService.markNotificationAsRead,
  markAllNotificationsAsRead: ApiService.markAllNotificationsAsRead,
};

export const UsersApi = {
  getUserSettings: ApiService.getUserSettings,
  updateUserSettings: ApiService.updateUserSettings,
};

export const BillingApi = {
  getSubscription: ApiService.getSubscription,
  previewProration: ApiService.previewProration,
  updateSubscription: ApiService.updateSubscription,
  initializeCheckout: ApiService.initializeCheckout,
};

export const SwapsApi = {
  async getTeamSwaps(teamId: string, status?: string): Promise<any[]> {
    const qs = status ? `?status=${status}` : '';
    return await request<any[]>(`/swaps/teams/${teamId}${qs}`);
  },

  async requestSwap(
    teamId: string,
    data: { shiftId: string; type: 'DIRECT_SWAP' | 'OPEN_SHIFT'; targetUserId?: string; reason?: string }
  ): Promise<any> {
    return await request<any>(`/swaps/teams/${teamId}/request`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async claimOpenShift(teamId: string, swapId: string): Promise<any> {
    return await request<any>(`/swaps/teams/${teamId}/claim/${swapId}`, {
      method: 'POST',
    });
  },

  async approveSwap(teamId: string, swapId: string): Promise<any> {
    return await request<any>(`/swaps/teams/${teamId}/approve/${swapId}`, {
      method: 'POST',
    });
  },

  async rejectSwap(teamId: string, swapId: string, reason?: string): Promise<any> {
    return await request<any>(`/swaps/teams/${teamId}/reject/${swapId}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },
};

async function responseOrError(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json.error || new Error('Request failed');
  return json;
}


import { StorageService } from './storage';

// Base API configuration from environment
const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.API_URL ||
  'http://192.168.100.33:5001/api/v1';

// Server origin for non-versioned endpoints like /health
const SERVER_ORIGIN = BASE_URL.replace('/api/v1', '');

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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

  async register(data: { email: string; password: string; firstName: string; lastName?: string }) {
    const res = await request<{ user: any; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res?.token) {
      await StorageService.setToken(res.token);
    }
    return res;
  },

  async login(data: { email: string; password: string }) {
    const res = await request<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res?.token) {
      await StorageService.setToken(res.token);
    }
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST' });
    } finally {
      await StorageService.clearToken();
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

  async getActivityFeed(teamId: string, page: number = 1, limit: number = 20): Promise<{ items: any[]; pagination: any }> {
    const res = await fetch(`${BASE_URL}/shifts/teams/${teamId}/activity?page=${page}&limit=${limit}`, {
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
};

async function responseOrError(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw json.error || new Error('Request failed');
  return json;
}

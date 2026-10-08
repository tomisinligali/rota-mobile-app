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
};

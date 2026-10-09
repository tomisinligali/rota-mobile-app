import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiService } from './api';

// Centralised query keys so mutations can invalidate exactly what changed.
export const queryKeys = {
  dashboardSummary: ['dashboard', 'summary'] as const,
  teams: ['teams'] as const,
  notifications: ['notifications'] as const,
  userSettings: ['userSettings'] as const,
  teamMembers: (teamId: string) => ['team', teamId, 'members'] as const,
  teamShifts: (teamId: string) => ['team', teamId, 'shifts'] as const,
  teamActivity: (teamId: string, page: number, limit: number) =>
    ['team', teamId, 'activity', page, limit] as const,
  teamSwaps: (teamId: string) => ['team', teamId, 'swaps'] as const,
  subscription: (businessId: string) => ['subscription', businessId] as const,
};

// ---- Server-state read hooks (fetch + cache + refresh) ----

export function useDashboardSummaryQuery() {
  return useQuery({
    queryKey: queryKeys.dashboardSummary,
    queryFn: () => ApiService.getDashboardSummary(),
  });
}

export function useTeamsQuery() {
  return useQuery({ queryKey: queryKeys.teams, queryFn: () => ApiService.getTeams() });
}

export function useNotificationsQuery() {
  return useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => ApiService.getNotifications(),
  });
}

export function useUserSettingsQuery() {
  return useQuery({
    queryKey: queryKeys.userSettings,
    queryFn: () => ApiService.getUserSettings(),
  });
}

export function useTeamMembersQuery(teamId?: string) {
  return useQuery({
    queryKey: queryKeys.teamMembers(teamId ?? ''),
    queryFn: () => ApiService.getTeamMembers(teamId as string),
    enabled: !!teamId,
  });
}

export function useTeamShiftsQuery(teamId?: string) {
  return useQuery({
    queryKey: queryKeys.teamShifts(teamId ?? ''),
    queryFn: () => ApiService.getShifts(teamId as string),
    enabled: !!teamId,
  });
}

export function useTeamActivityQuery(teamId?: string, limit = 20, cursor?: string | null) {
  return useQuery({
    queryKey: queryKeys.teamActivity(teamId ?? '', 1, limit),
    queryFn: () => ApiService.getActivityFeed(teamId as string, limit, cursor),
    enabled: !!teamId,
  });
}

export function useTeamActivityInfiniteQuery(teamId?: string, limit = 20) {
  return useInfiniteQuery({
    queryKey: ['teamActivityInfinite', teamId ?? '', limit] as const,
    queryFn: ({ pageParam }) =>
      ApiService.getActivityFeed(teamId as string, limit, pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasMore ? lastPage.pagination.nextCursor : undefined,
    enabled: !!teamId,
  });
}

export function useTeamSwapsQuery(teamId?: string) {
  return useQuery({
    queryKey: queryKeys.teamSwaps(teamId ?? ''),
    queryFn: () => ApiService.getTeamSwaps(teamId as string),
    enabled: !!teamId,
  });
}

export function useSubscriptionQuery(businessId?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.subscription(businessId ?? ''),
    queryFn: () => ApiService.getSubscription(businessId as string),
    enabled: !!businessId && enabled,
  });
}

// ---- Mutations ----

interface NotificationsCache {
  items: any[];
  unreadCount: number;
}

/**
 * Marking a notification read is a safe optimistic mutation: the UI updates
 * instantly and rolls back to the previous cache if the request fails.
 */
export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => ApiService.markNotificationAsRead(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const previous = queryClient.getQueryData<NotificationsCache>(queryKeys.notifications);

      if (previous) {
        queryClient.setQueryData<NotificationsCache>(queryKeys.notifications, {
          items: previous.items.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
          ),
          unreadCount: Math.max((previous.unreadCount ?? 1) - 1, 0),
        });
      }

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.notifications, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });
}

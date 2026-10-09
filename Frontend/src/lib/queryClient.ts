import { QueryClient } from '@tanstack/react-query';

// Shared cache for server state (shifts, members, teams, subscriptions).
// staleTime keeps recently fetched data fresh so tab switches do not refetch
// on every render, while invalidation after mutations forces a refresh.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../api/notifications';

/** Checks for new notifications every 30 seconds (and when the tab regains focus). */
export function useNotificationSummary() {
  return useQuery({
    queryKey: ['notifications', 'summary'],
    queryFn: () => listNotifications({ limit: 8 }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useNotificationActions() {
  const queryClient = useQueryClient();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  return {
    markRead: useMutation({ mutationFn: markNotificationRead, onSuccess: refresh }),
    markAll: useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh }),
  };
}

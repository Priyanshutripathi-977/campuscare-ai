import type { NotificationListDTO } from '@campuscare/shared';
import { apiFetch, apiSend, toQueryString } from './client';

export const listNotifications = (opts: { unread?: boolean; page?: number; limit?: number } = {}) =>
  apiFetch<NotificationListDTO>(
    `/notifications${toQueryString({ unread: opts.unread ? 'true' : undefined, page: opts.page, limit: opts.limit })}`,
  );

export const markNotificationRead = (id: string) =>
  apiSend<{ id: string }>('PATCH', `/notifications/${id}/read`);

export const markAllNotificationsRead = () =>
  apiSend<{ updated: number }>('POST', '/notifications/read-all');

import type {
  Category,
  CreateTicketInput,
  Paginated,
  Priority,
  Status,
  TicketDetailDTO,
  TicketQuery,
  TicketSummaryDTO,
} from '@campuscare/shared';
import { apiFetch, apiSend, toQueryString } from './client';

type Detail = { ticket: TicketDetailDTO };

/** Query values come straight from the URL; the server validates them (bad values → 400). */
export const listTickets = (
  query: Partial<Record<keyof TicketQuery, string | number | undefined>>,
) => apiFetch<Paginated<TicketSummaryDTO>>(`/tickets${toQueryString(query)}`);

export const getTicket = (ticketId: string) =>
  apiFetch<Detail>(`/tickets/${encodeURIComponent(ticketId)}`).then((r) => r.ticket);

/** Complaint + optional image are sent together as multipart/form-data. */
export function createTicket(input: CreateTicketInput, image: File | null) {
  const form = new FormData();
  form.append('data', JSON.stringify(input));
  if (image) form.append('image', image);
  return apiFetch<Detail>('/tickets', { method: 'POST', body: form }).then((r) => r.ticket);
}

export const ticketImageUrl = (ticketId: string) =>
  `/api/tickets/${encodeURIComponent(ticketId)}/image`;

const path = (id: string, action: string) => `/tickets/${encodeURIComponent(id)}/${action}`;

export const addUpdate = (id: string, message: string) =>
  apiSend<Detail>('POST', path(id, 'updates'), { message }).then((r) => r.ticket);

export const changeStatus = (
  id: string,
  body: { status: Status; note?: string; confirm?: boolean },
) => apiSend<Detail>('PATCH', path(id, 'status'), body).then((r) => r.ticket);

export const reopenTicket = (id: string, reason: string) =>
  apiSend<Detail>('POST', path(id, 'reopen'), { reason }).then((r) => r.ticket);

export const classifyTicket = (id: string, body: { category: Category; priority: Priority }) =>
  apiSend<Detail>('PATCH', path(id, 'classification'), body).then((r) => r.ticket);

export const assignTicket = (
  id: string,
  body: { departmentId: string; assignedTo?: string | null; note?: string },
) => apiSend<Detail>('PATCH', path(id, 'assign'), body).then((r) => r.ticket);

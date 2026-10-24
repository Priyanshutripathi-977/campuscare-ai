import type {
  Category,
  DepartmentDTO,
  DuplicateSuggestionDTO,
  Paginated,
  SettingsDTO,
  SettingsUpdateInput,
  StaffDTO,
  StatsDTO,
} from '@campuscare/shared';
import { apiFetch, apiSend, toQueryString } from './client';

export const getStats = () => apiFetch<{ stats: StatsDTO }>('/admin/stats').then((r) => r.stats);

export const getDepartments = () =>
  apiFetch<{ departments: DepartmentDTO[] }>('/admin/departments').then((r) => r.departments);

export const getStaff = (department?: string) =>
  apiFetch<{ staff: StaffDTO[] }>(`/admin/staff${toQueryString({ department })}`).then(
    (r) => r.staff,
  );

export interface SettingsResponse {
  settings: SettingsDTO;
  /** Only whether AI is configured — the API key itself never leaves the server. */
  ai: { configured: boolean; provider: string };
}

export const getSettings = () => apiFetch<SettingsResponse>('/admin/settings');

export const updateSettings = (input: SettingsUpdateInput) =>
  apiSend<{ settings: SettingsDTO }>('PATCH', '/admin/settings', input).then((r) => r.settings);

export const updateDepartmentCategories = (id: string, categories: Category[]) =>
  apiSend<{ department: DepartmentDTO }>('PATCH', `/admin/departments/${id}`, { categories }).then(
    (r) => r.department,
  );

export type DuplicateTab = 'pending' | 'confirmed' | 'dismissed';

export const listDuplicates = (status: DuplicateTab, page = 1) =>
  apiFetch<Paginated<DuplicateSuggestionDTO>>(
    `/admin/duplicates${toQueryString({ status, page })}`,
  );

/** Confirming only LINKS the tickets; nothing is merged or closed. */
export const decideDuplicate = (id: string, decision: 'confirmed' | 'dismissed', note?: string) =>
  apiSend<{ suggestion: { id: string; status: string } }>('PATCH', `/admin/duplicates/${id}`, {
    decision,
    note,
  });

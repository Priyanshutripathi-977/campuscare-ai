import type {
  Category,
  DepartmentDTO,
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

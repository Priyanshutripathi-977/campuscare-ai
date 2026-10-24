import type { DepartmentDTO, StaffDTO, StatsDTO } from '@campuscare/shared';
import { apiFetch, toQueryString } from './client';

export const getStats = () => apiFetch<{ stats: StatsDTO }>('/admin/stats').then((r) => r.stats);

export const getDepartments = () =>
  apiFetch<{ departments: DepartmentDTO[] }>('/admin/departments').then((r) => r.departments);

export const getStaff = (department?: string) =>
  apiFetch<{ staff: StaffDTO[] }>(`/admin/staff${toQueryString({ department })}`).then(
    (r) => r.staff,
  );

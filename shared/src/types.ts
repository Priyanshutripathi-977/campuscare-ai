/**
 * Shapes of the JSON the API sends back ("DTOs" = data transfer objects).
 * The server builds these; the client uses them for type-safe rendering.
 */
import type { Category, Priority, Role, Status } from './constants';

export interface UserDTO {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: { id: string; name: string } | null;
}

export interface StatusHistoryEntry {
  from: Status | null;
  to: Status;
  by: { id: string; name: string; role: Role } | null;
  note?: string;
  at: string;
}

export interface TicketUpdateEntry {
  id: string;
  author: { id: string; name: string; role: Role } | null;
  message: string;
  at: string;
}

export interface TicketSummaryDTO {
  id: string;
  ticketId: string;
  title: string;
  status: Status;
  category: Category | null;
  priority: Priority | null;
  location: { building: string; room?: string; details?: string };
  department: { id: string; name: string } | null;
  needsReview: boolean;
  overdue: boolean;
  dueAt: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketDetailDTO extends TicketSummaryDTO {
  description: string;
  studentCategory: Category | null;
  /** Only visible to staff/admin. Email only to admin. */
  student: { id: string; name: string; email?: string } | null;
  assignedTo: { id: string; name: string } | null;
  hasImage: boolean;
  reviewReasons: string[];
  classification: { source: 'admin' | 'ai'; by: string | null; at: string } | null;
  routing: { method: 'auto' | 'manual' | 'admin_review'; reason: string; decidedAt: string } | null;
  resolvedAt: string | null;
  statusHistory: StatusHistoryEntry[];
  updates: TicketUpdateEntry[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface DepartmentDTO {
  id: string;
  name: string;
  code: string;
  categories: Category[];
}

export interface StaffDTO {
  id: string;
  name: string;
  department: { id: string; name: string } | null;
}

export interface StatsDTO {
  scope: 'all' | 'department';
  total: number;
  open: number;
  overdue: number;
  needsReview: number;
  resolved: number;
  avgResolutionHours: number | null;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  byDepartment: { name: string; count: number }[];
  createdPerDay: { date: string; count: number }[];
}

export interface ApiErrorBody {
  error: { message: string; details?: { fieldErrors?: Record<string, string> } };
}

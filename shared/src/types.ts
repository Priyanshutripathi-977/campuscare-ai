/**
 * Shapes of the JSON the API sends back ("DTOs" = data transfer objects).
 * The server builds these; the client uses them for type-safe rendering.
 */
import type { Category, Priority, Role, Status } from './constants';
import type { DuplicateRules, RoutingRules } from './ai';

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

/** AI analysis as shown to staff/admin (`view: 'full'`). */
export interface AiAnalysisDTO {
  view: 'full';
  source: 'gemini' | 'fallback_rules';
  model: string | null;
  valid: boolean;
  error: string | null;
  category: Category | null;
  priority: Priority | null;
  confidence: number | null;
  summary: string | null;
  extractedLocation: { building?: string | null; room?: string | null } | null;
  keyDetails: string[];
  categoryReason: string | null;
  priorityReason: string | null;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  safetyRisk: boolean;
  recommendedDepartment: { id: string; name: string } | null;
  processedAt: string;
}

/**
 * What the reporting student may see about the analysis of THEIR OWN complaint:
 * a plain summary and the suggestion — not internal reasons, errors or confidence.
 */
export interface StudentAiDTO {
  view: 'student';
  source: 'gemini' | 'fallback_rules';
  summary: string | null;
  category: Category | null;
  priority: Priority | null;
  recommendedDepartment: { id: string; name: string } | null;
  needsClarification: boolean;
  clarificationQuestion: string | null;
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
  /** Full AI analysis for staff/admin; a limited view for the student who reported it. */
  ai: AiAnalysisDTO | StudentAiDTO | null;
  routing: { method: 'auto' | 'manual' | 'admin_review'; reason: string; decidedAt: string } | null;
  resolvedAt: string | null;
  duplicates: TicketDuplicatesDTO;
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
  /** Pending duplicate suggestions (admins only; null for staff). */
  pendingDuplicates: number | null;
  resolved: number;
  avgResolutionHours: number | null;
  byStatus: Record<string, number>;
  byCategory: Record<string, number>;
  byPriority: Record<string, number>;
  byDepartment: { name: string; count: number }[];
  /** Like byPriority, but only tickets that are not resolved yet ("Unassessed" = no priority). */
  openByPriority: Record<string, number>;
  /** Per department: workload and how quickly it resolves tickets (unassigned tickets excluded). */
  departmentPerformance: {
    name: string;
    open: number;
    resolved: number;
    overdue: number;
    avgResolutionHours: number | null;
  }[];
  createdPerDay: { date: string; count: number }[];
}

export interface SettingsDTO {
  slaHours: Record<Priority, number>;
  routing: RoutingRules;
  duplicates: DuplicateRules;
}

export type DuplicateStatus = 'pending' | 'confirmed' | 'dismissed';

/** A suggested duplicate pair. `ticket` is the newer complaint, `candidate` the possible original. */
export interface DuplicateSuggestionDTO {
  id: string;
  score: number;
  reasons: string[];
  status: DuplicateStatus;
  ticket: TicketSummaryDTO;
  candidate: TicketSummaryDTO;
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: { id: string; name: string } | null;
  note: string | null;
}

/** Duplicate info on a ticket. `suggestions` is only filled for admins. */
export interface TicketDuplicatesDTO {
  duplicateOf: { ticketId: string; title?: string } | null;
  suggestions: {
    id: string;
    score: number;
    reasons: string[];
    status: DuplicateStatus;
    other: { ticketId: string; title: string; status: Status };
  }[];
}

export interface ApiErrorBody {
  error: { message: string; details?: { fieldErrors?: Record<string, string> } };
}

export type EmailDeliveryStatus = 'not_configured' | 'pending' | 'sent' | 'failed';

export interface NotificationDTO {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
  ticket: { ticketId: string; title: string } | null;
  /** What really happened with the email copy (never assumed). */
  email: { status: EmailDeliveryStatus; error: string | null; sentAt: string | null };
}

export interface NotificationListDTO extends Paginated<NotificationDTO> {
  unreadCount: number;
}

/**
 * Converts database documents into the JSON shapes the client receives.
 * This is where we decide what each role is allowed to SEE (privacy).
 */
import type {
  Category,
  Priority,
  Role,
  Status,
  TicketDetailDTO,
  TicketSummaryDTO,
} from '@campuscare/shared';

// A ticket loaded with .populate(...).lean() — loosely typed because populated fields vary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PopulatedTicket = Record<string, any>;

const ref = (v: PopulatedTicket | null | undefined) =>
  v && typeof v === 'object' && 'name' in v ? { id: String(v._id), name: String(v.name) } : null;

const person = (v: PopulatedTicket | null | undefined) =>
  v && typeof v === 'object' && 'name' in v
    ? { id: String(v._id), name: String(v.name), role: v.role as Role }
    : null;

export function isOverdue(t: { dueAt?: Date | null; status: string }, now = new Date()) {
  return Boolean(t.dueAt && t.status !== 'Resolved' && new Date(t.dueAt) < now);
}

export function toTicketSummary(t: PopulatedTicket): TicketSummaryDTO {
  return {
    id: String(t._id),
    ticketId: t.ticketId,
    title: t.title,
    status: t.status as Status,
    category: (t.category ?? null) as Category | null,
    priority: (t.priority ?? null) as Priority | null,
    location: {
      building: t.location.building,
      room: t.location.room || undefined,
      details: t.location.details || undefined,
    },
    department: ref(t.department),
    needsReview: Boolean(t.needsReview),
    overdue: isOverdue(t as { dueAt?: Date | null; status: string }),
    dueAt: t.dueAt ? new Date(t.dueAt).toISOString() : null,
    isDemo: Boolean(t.isDemo),
    createdAt: new Date(t.createdAt).toISOString(),
    updatedAt: new Date(t.updatedAt).toISOString(),
  };
}

export function toTicketDetail(t: PopulatedTicket, viewerRole: Role): TicketDetailDTO {
  const isStudentViewer = viewerRole === 'student';
  return {
    ...toTicketSummary(t),
    description: t.description,
    studentCategory: (t.studentCategory ?? null) as Category | null,
    // Students already know who they are. Staff see only the name; admins also see the email.
    student: isStudentViewer
      ? null
      : t.student
        ? {
            id: String(t.student._id),
            name: t.student.name,
            ...(viewerRole === 'admin' ? { email: t.student.email } : {}),
          }
        : null,
    assignedTo: ref(t.assignedTo),
    hasImage: Boolean(t.image?.filename),
    // Internal review reasons and routing details are staff/admin information.
    reviewReasons: isStudentViewer ? [] : (t.reviewReasons ?? []),
    classification: t.classification
      ? {
          source: t.classification.source,
          by: t.classification.by ? String(t.classification.by) : null,
          at: new Date(t.classification.at).toISOString(),
        }
      : null,
    routing:
      !isStudentViewer && t.routing
        ? {
            method: t.routing.method,
            reason: t.routing.reason,
            decidedAt: new Date(t.routing.decidedAt).toISOString(),
          }
        : null,
    ai: toAiDTO(t, isStudentViewer),
    resolvedAt: t.resolvedAt ? new Date(t.resolvedAt).toISOString() : null,
    statusHistory: (t.statusHistory ?? []).map((h: PopulatedTicket) => ({
      from: h.from ?? null,
      to: h.to,
      by: person(h.by),
      note: h.note || undefined,
      at: new Date(h.at).toISOString(),
    })),
    updates: (t.updates ?? []).map((u: PopulatedTicket) => ({
      id: String(u._id),
      author: person(u.author),
      message: u.message,
      at: new Date(u.at).toISOString(),
    })),
  };
}

function toAiDTO(t: PopulatedTicket, isStudentViewer: boolean): TicketDetailDTO['ai'] {
  const ai = t.ai;
  if (!ai) return null;
  if (isStudentViewer) {
    // Students only see a clarification request, and only while it is still relevant.
    const asking = Boolean(ai.needsClarification) && t.status === 'Under Review';
    return asking
      ? { needsClarification: true, clarificationQuestion: ai.clarificationQuestion ?? null }
      : null;
  }
  return {
    source: ai.source,
    model: ai.model ?? null,
    valid: Boolean(ai.valid),
    error: ai.error ?? null,
    category: ai.category ?? null,
    priority: ai.priority ?? null,
    confidence: typeof ai.confidence === 'number' ? ai.confidence : null,
    summary: ai.summary ?? null,
    extractedLocation: ai.extractedLocation
      ? { building: ai.extractedLocation.building ?? null, room: ai.extractedLocation.room ?? null }
      : null,
    keyDetails: ai.keyDetails ?? [],
    categoryReason: ai.categoryReason ?? null,
    priorityReason: ai.priorityReason ?? null,
    needsClarification: Boolean(ai.needsClarification),
    clarificationQuestion: ai.clarificationQuestion ?? null,
    safetyRisk: Boolean(ai.safetyRisk),
    recommendedDepartment: ref(ai.recommendedDepartment),
    processedAt: new Date(ai.processedAt).toISOString(),
  };
}

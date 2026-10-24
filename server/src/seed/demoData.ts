/**
 * ⚠️ DEMO DATA ⚠️
 * Everything created here is fictional sample data for demonstrations and is flagged
 * with `isDemo: true` (the UI shows a "Demo" badge on these tickets).
 * Demo accounts use the reserved ".test" email domain and a shared demo password.
 */
import bcrypt from 'bcryptjs';
import { PRIORITY_RANK, type Category, type Priority, type Status } from '@campuscare/shared';
import { DepartmentModel } from '../models/Department';
import { UserModel } from '../models/User';
import { TicketModel } from '../models/Ticket';
import { getSettings } from '../models/Settings';
import { nextTicketId } from '../utils/ticketId';

/** Demo-only password for every demo account. Never use this for real accounts. */
export const DEMO_PASSWORD = 'Demo@1234';

export const DEMO_DEPARTMENTS: { code: string; name: string; categories: Category[] }[] = [
  { code: 'IT', name: 'IT Services', categories: ['IT'] },
  { code: 'ELEC', name: 'Electrical Maintenance', categories: ['Electrical'] },
  { code: 'PLMB', name: 'Plumbing & Water', categories: ['Plumbing'] },
  { code: 'HSKP', name: 'Housekeeping', categories: ['Housekeeping'] },
  { code: 'ACAD', name: 'Academic Facilities', categories: ['Classroom Facilities'] },
  { code: 'SEC', name: 'Campus Security', categories: ['Security'] },
  { code: 'ADMN', name: 'General Administration', categories: ['Other'] },
];

export const DEMO_USERS = {
  admin: { name: 'Demo Admin', email: 'admin@campuscare.test' },
  students: [
    { name: 'Aarav Mehta', email: 'student@campuscare.test', studentId: 'DEMO-CSE-101' },
    { name: 'Neha Singh', email: 'neha@campuscare.test', studentId: 'DEMO-ECE-214' },
  ],
  staff: [
    { name: 'Ravi Kumar', email: 'it.staff@campuscare.test', dept: 'IT' },
    { name: 'Sunita Rao', email: 'electrical.staff@campuscare.test', dept: 'ELEC' },
    { name: 'Imran Shaikh', email: 'plumbing.staff@campuscare.test', dept: 'PLMB' },
    { name: 'Meena Iyer', email: 'housekeeping.staff@campuscare.test', dept: 'HSKP' },
    { name: 'Joseph Thomas', email: 'academic.staff@campuscare.test', dept: 'ACAD' },
    { name: 'Vikram Patil', email: 'security.staff@campuscare.test', dept: 'SEC' },
  ],
};

interface DemoTicket {
  student: 0 | 1;
  title: string;
  description: string;
  building: string;
  room?: string;
  category: Category | null; // null = still awaiting classification
  priority: Priority | null;
  status: Status;
  daysAgo: number;
}

const DEMO_TICKETS: DemoTicket[] = [
  {
    student: 0,
    title: 'Wi-Fi not working in library reading hall',
    description:
      'The CampusNet Wi-Fi keeps disconnecting every few minutes on the first floor of the library. Multiple students have the same issue since Monday.',
    building: 'Central Library',
    room: 'Reading Hall 1',
    category: 'IT',
    priority: 'High',
    status: 'In Progress',
    daysAgo: 3,
  },
  {
    student: 1,
    title: 'Sparking switchboard in Lab 3',
    description:
      'The switchboard near the door of Electronics Lab 3 sparks when the projector is plugged in. There is a burning smell. Students are avoiding that socket.',
    building: 'Engineering Block B',
    room: 'Lab 3',
    category: 'Electrical',
    priority: 'Critical',
    status: 'Assigned',
    daysAgo: 1,
  },
  {
    student: 0,
    title: 'Water leaking from ceiling in corridor',
    description:
      'Water is dripping from the ceiling outside room 204 whenever the tank above is filled. The floor becomes slippery and someone could fall.',
    building: 'Engineering Block A',
    room: 'Corridor near 204',
    category: 'Plumbing',
    priority: 'High',
    status: 'Resolved',
    daysAgo: 9,
  },
  {
    student: 1,
    title: 'Washroom not cleaned on second floor',
    description:
      'The girls washroom on the second floor of the main building has not been cleaned for two days and the dustbins are overflowing.',
    building: 'Main Building',
    room: '2nd floor washroom',
    category: 'Housekeeping',
    priority: 'Medium',
    status: 'Resolved',
    daysAgo: 6,
  },
  {
    student: 0,
    title: 'Projector flickering in lecture hall',
    description:
      'The projector in LH-5 flickers and turns off every 10 minutes during lectures. Faculty have to restart it repeatedly which wastes class time.',
    building: 'Lecture Hall Complex',
    room: 'LH-5',
    category: 'Classroom Facilities',
    priority: 'Medium',
    status: 'Assigned',
    daysAgo: 5,
  },
  {
    student: 1,
    title: 'Broken lock on hostel back gate',
    description:
      'The lock on the back gate of the girls hostel is broken and the gate stays open at night. Unknown people were seen near the gate yesterday.',
    building: 'Girls Hostel',
    room: 'Back gate',
    category: 'Security',
    priority: 'High',
    status: 'In Progress',
    daysAgo: 2,
  },
  {
    student: 0,
    title: 'Computer lab PCs not booting',
    description:
      'Six computers in the third row of Computer Lab 2 show a blue screen and restart continuously. We have a practical exam next week.',
    building: 'Engineering Block A',
    room: 'Computer Lab 2',
    category: 'IT',
    priority: 'High',
    status: 'Assigned',
    daysAgo: 8,
  },
  {
    student: 1,
    title: 'Tube lights not working in classroom',
    description:
      'Three of the four tube lights in classroom 108 are not working. Evening classes are difficult because the room is very dark.',
    building: 'Main Building',
    room: '108',
    category: 'Electrical',
    priority: 'Medium',
    status: 'Resolved',
    daysAgo: 12,
  },
  {
    student: 0,
    title: 'Drinking water cooler not cooling',
    description:
      'The water cooler next to the canteen gives warm water. It has been like this for almost a week and it is very hot outside.',
    building: 'Canteen',
    category: 'Plumbing',
    priority: 'Low',
    status: 'Assigned',
    daysAgo: 10,
  },
  {
    student: 1,
    title: 'Benches broken in seminar hall',
    description:
      'At least five benches in the seminar hall have broken seats and loose screws. Students have torn their clothes on the exposed screws.',
    building: 'Admin Block',
    room: 'Seminar Hall',
    category: 'Classroom Facilities',
    priority: 'Low',
    status: 'In Progress',
    daysAgo: 4,
  },
  {
    student: 0,
    title: 'Strange smell near chemistry lab',
    description:
      'There is a strong strange smell in the corridor near the chemistry lab since this morning. Not sure what it is or which department should check it.',
    building: 'Science Block',
    room: 'Chemistry lab corridor',
    category: null,
    priority: null,
    status: 'Under Review',
    daysAgo: 0,
  },
  {
    student: 1,
    title: 'Garbage pile near parking area',
    description:
      'Garbage has been dumped near the two-wheeler parking area and it is attracting stray dogs. It smells bad in the afternoon.',
    building: 'Parking Area',
    category: null,
    priority: null,
    status: 'Under Review',
    daysAgo: 1,
  },
  {
    student: 0,
    title: 'Library entry gate scanner broken',
    description:
      'The ID card scanner at the library entry gate does not read cards, so the guard is writing names manually and there is a long queue.',
    building: 'Central Library',
    room: 'Entrance',
    category: 'IT',
    priority: 'Medium',
    status: 'Reopened',
    daysAgo: 7,
  },
];

export interface SeedResult {
  departments: number;
  users: number;
  tickets: number;
  skippedTickets: boolean;
}

export async function seedDemoData({ reset = false } = {}): Promise<SeedResult> {
  if (reset) {
    // Only removes records flagged as demo data — real data is never touched.
    await TicketModel.deleteMany({ isDemo: true });
    await UserModel.deleteMany({ isDemo: true });
  }

  const settings = await getSettings();

  // Departments are configuration: upsert by code (safe to run repeatedly).
  const deptByCode = new Map<string, Awaited<ReturnType<typeof DepartmentModel.findOne>>>();
  for (const d of DEMO_DEPARTMENTS) {
    const doc = await DepartmentModel.findOneAndUpdate(
      { code: d.code },
      { $setOnInsert: { name: d.name, code: d.code, categories: d.categories, active: true } },
      { upsert: true, returnDocument: 'after' },
    );
    deptByCode.set(d.code, doc);
  }
  const deptForCategory = (c: Category) =>
    [...deptByCode.values()].find((d) => d?.categories.includes(c));

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const upsertUser = async (data: { email: string; [key: string]: unknown }) => {
    const user = await UserModel.findOneAndUpdate(
      { email: data.email },
      { $setOnInsert: { ...data, passwordHash, isDemo: true } },
      { upsert: true, returnDocument: 'after' },
    ).lean();
    return user!;
  };

  const admin = await upsertUser({ ...DEMO_USERS.admin, role: 'admin' });
  const students = await Promise.all(
    DEMO_USERS.students.map((s) => upsertUser({ ...s, role: 'student' })),
  );
  const staff = await Promise.all(
    DEMO_USERS.staff.map((s) =>
      upsertUser({
        name: s.name,
        email: s.email,
        role: 'staff',
        department: deptByCode.get(s.dept)!._id,
      }),
    ),
  );
  const staffByDept = new Map(staff.map((s) => [String(s.department), s]));

  // Don't create a second set of demo tickets if they already exist.
  if (await TicketModel.exists({ isDemo: true })) {
    return {
      departments: deptByCode.size,
      users: 1 + students.length + staff.length,
      tickets: 0,
      skippedTickets: true,
    };
  }

  const now = Date.now();
  const HOUR = 3600_000;
  // Oldest first so ticket numbers increase with time.
  const ordered = [...DEMO_TICKETS].sort((a, b) => b.daysAgo - a.daysAgo);
  for (const [i, t] of ordered.entries()) {
    const createdAt = new Date(now - t.daysAgo * 24 * HOUR - (i % 5) * HOUR - 2 * HOUR);
    const student = students[t.student]!;
    const dept = t.category ? deptForCategory(t.category) : null;
    const assignee = dept ? staffByDept.get(String(dept._id)) : null;
    const at = (h: number) => new Date(createdAt.getTime() + h * HOUR);

    const history: { from: Status | null; to: Status; by: unknown; note?: string; at: Date }[] = [
      { from: null, to: 'Submitted', by: student._id, note: 'Complaint submitted', at: createdAt },
      {
        from: 'Submitted',
        to: 'Under Review',
        by: null,
        note: 'Sent to an administrator for classification',
        at: createdAt,
      },
    ];
    if (dept && t.status !== 'Under Review') {
      history.push({
        from: 'Under Review',
        to: 'Assigned',
        by: admin!._id,
        note: `Assigned to ${dept.name}`,
        at: at(1),
      });
      if (['In Progress', 'Resolved', 'Reopened'].includes(t.status)) {
        history.push({
          from: 'Assigned',
          to: 'In Progress',
          by: assignee?._id ?? admin!._id,
          note: 'Work started',
          at: at(3),
        });
      }
      if (['Resolved', 'Reopened'].includes(t.status)) {
        history.push({
          from: 'In Progress',
          to: 'Resolved',
          by: assignee?._id ?? admin!._id,
          note: 'Issue fixed and verified on site',
          at: at(20),
        });
      }
      if (t.status === 'Reopened') {
        history.push({
          from: 'Resolved',
          to: 'Reopened',
          by: student._id,
          note: 'The problem has started again',
          at: at(40),
        });
      }
    }

    const resolved = t.status === 'Resolved';
    await TicketModel.create({
      ticketId: await nextTicketId(createdAt),
      student: student._id,
      title: t.title,
      description: t.description,
      location: { building: t.building, room: t.room },
      studentCategory: null,
      category: t.category,
      priority: t.priority,
      priorityRank: t.priority ? PRIORITY_RANK[t.priority] : 0,
      classification: t.category ? { source: 'admin', by: admin!._id, at: at(1) } : null,
      status: t.status,
      department: dept?._id ?? null,
      assignedTo: dept ? (assignee?._id ?? null) : null,
      needsReview: !dept,
      reviewReasons: dept ? [] : ['awaiting_classification'],
      routing: dept
        ? {
            method: 'manual',
            decidedBy: admin!._id,
            reason: `Assigned to ${dept.name} by an administrator`,
            decidedAt: at(1),
          }
        : {
            method: 'admin_review',
            reason: 'Automatic classification is not enabled yet; an administrator will review it.',
            decidedAt: createdAt,
          },
      dueAt: t.priority
        ? new Date(createdAt.getTime() + settings.slaHours![t.priority]! * HOUR)
        : null,
      resolvedAt: resolved ? at(20) : null,
      statusHistory: history,
      updates:
        t.status === 'In Progress'
          ? [
              {
                author: assignee?._id ?? admin!._id,
                authorRole: 'staff',
                message: 'We have checked the issue and ordered the required parts.',
                at: at(4),
              },
            ]
          : [],
      isDemo: true,
      createdAt,
      updatedAt: history.at(-1)!.at,
    });
  }

  return {
    departments: deptByCode.size,
    users: 1 + students.length + staff.length,
    tickets: ordered.length,
    skippedTickets: false,
  };
}

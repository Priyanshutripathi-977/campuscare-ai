import { describe, expect, it } from 'vitest';
import { canTransition, CreateTicketSchema, StatusChangeSchema } from '@campuscare/shared';

describe('canTransition', () => {
  it('lets staff only do the hands-on steps', () => {
    expect(canTransition('staff', 'Assigned', 'In Progress')).toBe(true);
    expect(canTransition('staff', 'In Progress', 'Resolved')).toBe(true);
    expect(canTransition('staff', 'Reopened', 'In Progress')).toBe(true);
    expect(canTransition('staff', 'Assigned', 'Under Review')).toBe(true); // send back to admin
    expect(canTransition('staff', 'Assigned', 'Resolved')).toBe(false);
    expect(canTransition('staff', 'Resolved', 'Reopened')).toBe(false);
  });

  it('never lets anyone skip steps', () => {
    expect(canTransition('admin', 'Submitted', 'Resolved')).toBe(false);
    expect(canTransition('admin', 'Assigned', 'Resolved')).toBe(false);
  });

  it('keeps reopening as the student’s decision', () => {
    expect(canTransition('admin', 'Resolved', 'Reopened')).toBe(false);
    expect(canTransition('student', 'Assigned', 'In Progress')).toBe(false);
  });
});

describe('shared schemas', () => {
  it('requires confirmation and a note to resolve', () => {
    expect(StatusChangeSchema.safeParse({ status: 'Resolved' }).success).toBe(false);
    expect(
      StatusChangeSchema.safeParse({ status: 'Resolved', confirm: true, note: 'Done fixing' })
        .success,
    ).toBe(true);
    expect(StatusChangeSchema.safeParse({ status: 'In Progress' }).success).toBe(true);
  });

  it('treats an empty category as "let the system decide"', () => {
    const r = CreateTicketSchema.parse({
      title: 'Broken window',
      description: 'The window in room 12 is broken and rain comes in.',
      location: { building: 'Hostel A', room: '' },
      category: '',
    });
    expect(r.category).toBeUndefined();
    expect(r.location.room).toBeUndefined();
  });
});

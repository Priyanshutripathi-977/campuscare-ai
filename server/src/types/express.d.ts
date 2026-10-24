import type { Role } from '@campuscare/shared';

// Tells TypeScript that requests may carry the logged-in user (set by requireAuth).
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        role: Role;
        departmentId: string | null;
      };
    }
  }
}

export {};

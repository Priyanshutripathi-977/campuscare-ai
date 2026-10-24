/** Helpers that create users/departments and logged-in HTTP "agents" for tests. */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import type { Express } from 'express';
import type { Role } from '@campuscare/shared';
import { UserModel } from '../../src/models/User';
import { DepartmentModel } from '../../src/models/Department';

export const PASSWORD = 'Passw0rd!';
let hash: string | undefined;

export async function clearDatabase() {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
}

export async function createDepartment(code = 'ELEC', name = 'Electrical Maintenance') {
  return DepartmentModel.create({ code, name, categories: ['Electrical'] });
}

export async function createUser(
  role: Role,
  email: string,
  departmentId?: mongoose.Types.ObjectId,
) {
  hash ??= await bcrypt.hash(PASSWORD, 4); // low cost = fast tests
  return UserModel.create({
    name: `${role} ${email}`,
    email,
    passwordHash: hash,
    role,
    department: departmentId ?? null,
  });
}

/** Returns a supertest agent that keeps the login cookie between requests. */
export async function loginAs(app: Express, email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password: PASSWORD });
  if (res.status !== 200)
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

// A real 1x1 PNG image.
export const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export const validComplaint = {
  title: 'Fan not working in room 101',
  description: 'The ceiling fan in room 101 stopped working yesterday and the room is very hot.',
  location: { building: 'Main Building', room: '101' },
};

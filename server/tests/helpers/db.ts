/**
 * Test helper: starts a throwaway in-memory MongoDB so tests never touch
 * your real development database. (The first run downloads a MongoDB binary.)
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDatabase, disconnectDatabase } from '../../src/db/connect';

let mongo: MongoMemoryServer | undefined;

export async function startTestDatabase() {
  mongo = await MongoMemoryServer.create();
  await connectDatabase(mongo.getUri());
}

export async function stopTestDatabase() {
  await disconnectDatabase();
  await mongo?.stop();
}

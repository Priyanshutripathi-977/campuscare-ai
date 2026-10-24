/**
 * MongoDB connection helpers (using Mongoose).
 *
 * connectDatabase()  – called once at startup; throws a friendly error if MongoDB is unreachable.
 * getDatabaseStatus() – used by the health check to report the *live* connection state.
 */
import mongoose from 'mongoose';

// Reject query filters containing fields that aren't in the schema (safer defaults).
mongoose.set('strictQuery', true);

export type DatabaseStatus = 'connected' | 'connecting' | 'disconnected' | 'disconnecting';

export async function connectDatabase(uri: string): Promise<void> {
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // give up after 5s instead of hanging
    });
  } catch (err) {
    throw new Error(
      `Could not connect to MongoDB at ${redactUri(uri)}.\n` +
        '   Is MongoDB running? On macOS try: brew services start mongodb/brew/mongodb-community\n' +
        `   Original error: ${(err as Error).message}`,
      { cause: err },
    );
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export function getDatabaseStatus(): DatabaseStatus {
  // Mongoose readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const states: Record<number, DatabaseStatus> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] ?? 'disconnected';
}

/** Hides any username/password in a connection string before it is logged. */
export function redactUri(uri: string): string {
  return uri.replace(/\/\/([^@/]+)@/, '//***:***@');
}

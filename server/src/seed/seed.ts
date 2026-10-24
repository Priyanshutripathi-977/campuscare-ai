/**
 * Loads DEMO data into the database.
 *   npm run seed            → adds demo departments, accounts and tickets (if not already there)
 *   npm run seed -- --reset → deletes ONLY demo-flagged tickets/users, then recreates them
 */
import { env } from '../config/env';
import { connectDatabase, disconnectDatabase, redactUri } from '../db/connect';
import { DEMO_PASSWORD, DEMO_USERS, seedDemoData } from './demoData';

async function main() {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to load demo data in production.');
  }
  const reset = process.argv.includes('--reset');
  await connectDatabase(env.MONGODB_URI);
  console.log(`Connected to ${redactUri(env.MONGODB_URI)}${reset ? ' (resetting demo data)' : ''}`);

  const result = await seedDemoData({ reset });
  console.log(`✅ Demo departments: ${result.departments}, demo accounts: ${result.users}`);
  console.log(
    result.skippedTickets
      ? 'ℹ️  Demo tickets already exist — skipped. Use "npm run seed -- --reset" to recreate them.'
      : `✅ Demo tickets created: ${result.tickets}`,
  );
  console.log(`\nDemo logins (password for all: ${DEMO_PASSWORD})`);
  console.log(`  Admin:   ${DEMO_USERS.admin.email}`);
  console.log(`  Student: ${DEMO_USERS.students[0]!.email}`);
  console.log(`  Staff:   ${DEMO_USERS.staff[0]!.email} (IT Services)`);
  await disconnectDatabase();
}

main().catch(async (err: Error) => {
  console.error(`❌ ${err.message}`);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});

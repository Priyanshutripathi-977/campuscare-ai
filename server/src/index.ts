/** Entry point: connects to MongoDB, then starts listening for requests. */
import { createApp } from './app';
import { env } from './config/env';
import { connectDatabase, disconnectDatabase, redactUri } from './db/connect';

async function main() {
  // Fail fast with a clear message if the database is not reachable.
  await connectDatabase(env.MONGODB_URI);
  console.log(`✅ Connected to MongoDB (${redactUri(env.MONGODB_URI)})`);

  const server = createApp().listen(env.API_PORT, () => {
    console.log(`✅ CampusCare API running at http://localhost:${env.API_PORT} (${env.NODE_ENV})`);
  });

  // Close connections cleanly when the process is stopped (Ctrl+C or a restart).
  const shutdown = (signal: string) => {
    console.log(`\n${signal} received — shutting down…`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err: Error) => {
  console.error(`❌ ${err.message}`);
  process.exit(1);
});

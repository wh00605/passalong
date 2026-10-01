// Runs a real PostgreSQL server locally (no Docker needed) for development and tests.
// Usage: npm run db:local   (leave it running in its own terminal)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import path from "node:path";

const dataDir = path.resolve(".pgdata");
const port = Number(process.env.LOCAL_PG_PORT ?? 5433);

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
});

if (!existsSync(path.join(dataDir, "PG_VERSION"))) {
  await pg.initialise();
}
await pg.start();

for (const name of ["passalong", "passalong_test"]) {
  try {
    await pg.createDatabase(name);
  } catch {
    // already exists
  }
}

console.log(`Local Postgres running on port ${port} (databases: passalong, passalong_test). Ctrl+C to stop.`);

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);

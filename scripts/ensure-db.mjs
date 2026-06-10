import process from 'node:process';
import { Client } from 'pg';

function getDatabaseName(databaseUrl) {
  const parsed = new URL(databaseUrl);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

  if (!dbName) {
    throw new Error('DATABASE_URL must include a database name in the path.');
  }

  return { parsed, dbName };
}

function createAdminUrl(parsedUrl) {
  const adminUrl = new URL(parsedUrl.toString());
  adminUrl.pathname = '/postgres';
  return adminUrl.toString();
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function ensureDatabaseExists() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set.');
  }

  const { parsed, dbName } = getDatabaseName(databaseUrl);
  const adminConnectionUrl = createAdminUrl(parsed);

  const client = new Client({ connectionString: adminConnectionUrl });
  await client.connect();

  try {
    const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);

    if (result.rowCount && result.rowCount > 0) {
      console.log(`Database ${dbName} already exists.`);
      return;
    }

    await client.query(`CREATE DATABASE ${quoteIdentifier(dbName)}`);
    console.log(`Created database ${dbName}.`);
  } finally {
    await client.end();
  }
}

ensureDatabaseExists().catch((error) => {
  console.error('Failed to ensure database exists.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

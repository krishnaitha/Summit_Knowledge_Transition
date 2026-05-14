import postgres from 'postgres';
import 'server-only';

const databaseUrl = process.env.DATABASE_URL;

// Throw at request time (not at module evaluation) so `next build` succeeds
// without DATABASE_URL. The real URL is required at runtime.
if (!databaseUrl && process.env.NEXT_PHASE !== 'phase-production-build') {
  throw new Error('DATABASE_URL environment variable is required');
}

const sql = postgres(databaseUrl ?? 'postgresql://build-placeholder/db', {
  ssl:
    process.env.NODE_ENV === 'production' &&
    Boolean(databaseUrl) &&
    process.env.DATABASE_SSL !== 'disable'
      ? 'require'
      : false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
});

export default sql;

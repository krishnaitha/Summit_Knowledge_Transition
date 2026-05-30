Create a new Postgres migration file for this project.

## Steps

1. Use Glob to list all files matching `postgres/migrations/*.sql`.
2. Parse the numeric prefix from each filename (e.g. `035_app_error_events.sql` → 35). Find the highest number and add 1 to get the next migration number. Zero-pad it to 3 digits.
3. Derive a snake*case filename slug from the user's description: `$ARGUMENTS`. The full filename is `postgres/migrations/<NNN>*<slug>.sql`.
4. Write the migration file. Follow these conventions from the existing migrations:
   - Use `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` — all migrations must be idempotent.
   - Use `uuid PRIMARY KEY DEFAULT gen_random_uuid()` for new table primary keys.
   - Use `timestamptz NOT NULL DEFAULT now()` for timestamp columns.
   - Add `CREATE INDEX` for any foreign key columns and columns that will be filtered/sorted frequently.
   - No `BEGIN`/`COMMIT` — node-pg-migrate wraps each file in a transaction automatically.
5. After writing the file, remind the user to run `npm run db:migrate` to apply it.

The migration description is: $ARGUMENTS

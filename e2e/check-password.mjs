import pg from 'pg';
import bcrypt from 'bcryptjs';

const pool = new pg.Pool({ connectionString: 'postgresql://postgres:Test321@127.0.0.1:5433/NextElevate' });

// Exact query from lib/auth/providers/credentials.ts
const { rows } = await pool.query(
  "SELECT id, email, full_name, role, password_hash FROM users WHERE email = $1 AND is_active = true AND auth_provider = 'credentials' LIMIT 1",
  ['krishna.aitha@nexturn.com']
);

console.log('User found:', rows.length > 0);
if (rows[0]) {
  const valid = await bcrypt.compare('Admin@123', rows[0].password_hash);
  console.log('Password valid:', valid);
  console.log('Role:', rows[0].role);
}
await pool.end();

import pg from 'pg';
const { Client } = pg;

const HASH = '$2b$12$LeDdjHDIZ7tx.HWrp/SbTOFu3W3j50fViRXPlo/NLbN8Bvmyi7/c6'; // TestPassword1!
const PROJECT_ID = '6c250977-f97e-42f4-b1fa-2798f105370d'; // Baymaster
const COUNT = 10;

const client = new Client({
  connectionString: 'postgresql://postgres:Test321@localhost:5433/NextElevate',
});

await client.connect();

// Insert test users
for (let i = 1; i <= COUNT; i++) {
  const email = `loadtest+${String(i).padStart(3, '0')}@example.com`;
  await client.query(
    `INSERT INTO users (email, full_name, password_hash, role, auth_provider, is_active)
     VALUES ($1, $2, $3, 'member', 'credentials', true)
     ON CONFLICT (email, auth_provider) DO NOTHING`,
    [email, `Load Test User ${i}`, HASH],
  );
}
console.log(`Inserted ${COUNT} test users`);

// Assign them to the project
const { rows } = await client.query(
  `SELECT id FROM users WHERE email LIKE 'loadtest+%@example.com'`,
);
for (const row of rows) {
  await client.query(
    `INSERT INTO project_members (project_id, user_id, role)
     VALUES ($1, $2, 'member')
     ON CONFLICT (project_id, user_id) DO NOTHING`,
    [PROJECT_ID, row.id],
  );
}
console.log(`Assigned ${rows.length} users to project Baymaster (${PROJECT_ID})`);

await client.end();
console.log('Done.');

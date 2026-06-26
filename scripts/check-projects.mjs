#!/usr/bin/env node

/**
 * Check project order and data
 */

import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:Test321@localhost:5433/NextElevate');

async function check() {
  try {
    console.log('📦 Checking projects...\n');

    const projects = await sql`SELECT id, name, created_at FROM projects ORDER BY created_at ASC`;
    console.log(`Found ${projects.length} projects:\n`);

    projects.forEach((p, i) => {
      console.log(`${i + 1}. ${p.name}`);
      console.log(`   ID: ${p.id}`);
      console.log(`   Created: ${new Date(p.created_at).toISOString()}\n`);
    });

    if (projects.length > 0) {
      const firstProject = projects[0];
      console.log(`\n📊 Testing with FIRST project: ${firstProject.name}\n`);

      // Test the summary function directly
      const summary = await sql`
        SELECT * FROM get_governance_summary(${firstProject.id}, 7)
      `;

      if (summary.length > 0) {
        const s = summary[0];
        console.log(`✓ Total interactions: ${s.total_interactions}`);
        console.log(`✓ Refusals: ${s.refusals_count}`);
        console.log(`✓ Violations: ${s.filter_violations_count}`);
        console.log(`✓ Quota exceeded: ${s.quota_exceeded_count}`);
      }
    }

    await sql.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

check();

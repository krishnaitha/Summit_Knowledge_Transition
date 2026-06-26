#!/usr/bin/env node

/**
 * Debug script to check governance data
 * Run: node scripts/check-governance-data.mjs
 */

import postgres from 'postgres';

const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:Test321@localhost:5433/NextElevate');

async function check() {
  console.log('🔍 Checking AI Governance Data...\n');

  try {
    // Get projects
    const projects = await sql`SELECT id, name FROM projects LIMIT 5`;
    console.log(`📦 Projects found: ${projects.length}`);
    if (projects.length > 0) {
      projects.forEach((p) => console.log(`   - ${p.name} (${p.id})`));
    }

    if (projects.length === 0) {
      console.log('❌ No projects found. Cannot check governance data.');
      await sql.end();
      return;
    }

    const projectId = projects[0].id;
    console.log(`\nUsing project: ${projects[0].name}\n`);

    // Check audit logs
    const auditCount = await sql`
      SELECT COUNT(*) as count FROM llm_interaction_audit_log WHERE project_id = ${projectId}
    `;
    console.log(`📝 Audit log entries: ${auditCount[0].count}`);

    // Check refusals
    const refusalCount = await sql`
      SELECT COUNT(*) as count FROM refusal_log WHERE project_id = ${projectId}
    `;
    console.log(`⛔ Refusal log entries: ${refusalCount[0].count}`);

    // Check violations
    const violationCount = await sql`
      SELECT COUNT(*) as count FROM content_filter_violations WHERE project_id = ${projectId}
    `;
    console.log(`🚨 Content violations: ${violationCount[0].count}`);

    // Check quotas
    const quotaCount = await sql`
      SELECT COUNT(*) as count FROM user_quotas WHERE project_id = ${projectId}
    `;
    console.log(`💰 User quotas: ${quotaCount[0].count}`);

    // Check policies
    const policyCount = await sql`
      SELECT COUNT(*) as count FROM governance_policies WHERE project_id = ${projectId}
    `;
    console.log(`📋 Governance policies: ${policyCount[0].count}`);

    // Try the summary function
    console.log('\n📊 Testing get_governance_summary() function...');
    const summary = await sql`
      SELECT * FROM get_governance_summary(${projectId}, 7)
    `;

    if (summary.length > 0) {
      const s = summary[0];
      console.log(`   ✓ Total interactions: ${s.total_interactions}`);
      console.log(`   ✓ Refusals: ${s.refusals_count}`);
      console.log(`   ✓ Filter violations: ${s.filter_violations_count}`);
      console.log(`   ✓ Quota exceeded: ${s.quota_exceeded_count}`);
      console.log(`   ✓ Most common refusal: ${s.most_common_refusal_reason || 'none'}`);
    } else {
      console.log('   ❌ No summary data returned');
    }

    // Show recent audit logs
    console.log('\n📝 Recent audit log entries:');
    const recentLogs = await sql`
      SELECT id, created_at, status, interaction_type FROM llm_interaction_audit_log
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT 5
    `;

    if (recentLogs.length > 0) {
      recentLogs.forEach((log) => {
        const date = new Date(log.created_at).toISOString();
        console.log(`   - ${date} | ${log.status} | ${log.interaction_type}`);
      });
    } else {
      console.log('   (No recent logs)');
    }

    // Show raw refusal log
    console.log('\n⛔ Recent refusals:');
    const recentRefusals = await sql`
      SELECT id, created_at, refusal_reason FROM refusal_log
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
      LIMIT 3
    `;

    if (recentRefusals.length > 0) {
      recentRefusals.forEach((r) => {
        const date = new Date(r.created_at).toISOString();
        console.log(`   - ${date} | ${r.refusal_reason}`);
      });
    } else {
      console.log('   (No refusals logged)');
    }

    console.log('\n✅ Data check complete!');
  } catch (error) {
    console.error('❌ Error checking data:', error);
  } finally {
    await sql.end();
  }
}

check();

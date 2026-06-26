import sql from './lib/db';

async function cleanup() {
  try {
    // Get all duplicate policies - keep only the latest per (project_id, policy_type)
    const duplicates = await sql`
      SELECT id, project_id, policy_type, created_at
      FROM governance_policies
      WHERE id NOT IN (
        SELECT DISTINCT ON (project_id, policy_type) id
        FROM governance_policies
        ORDER BY project_id, policy_type, created_at DESC
      )
      ORDER BY created_at DESC
    `;

    console.log('Found', duplicates.length, 'duplicate policies to delete');
    if (duplicates.length > 0) {
      duplicates.forEach(d => {
        console.log(`  - Deleting ${d.policy_type} (id: ${d.id})`);
      });
    }

    if (duplicates.length > 0) {
      const ids = duplicates.map(d => d.id);
      await sql`
        DELETE FROM governance_policies
        WHERE id = ANY(${ids})
      `;
      console.log('\n✓ Deleted', duplicates.length, 'duplicate policies');
    } else {
      console.log('✓ No duplicates found');
    }

    // Show what's left
    const remaining = await sql`
      SELECT id, project_id, policy_type, enabled
      FROM governance_policies
      ORDER BY policy_type
    `;

    console.log('\nRemaining policies:');
    remaining.forEach(r => {
      console.log(`  - ${r.policy_type}: ${r.enabled ? 'enabled' : 'disabled'}`);
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

cleanup();

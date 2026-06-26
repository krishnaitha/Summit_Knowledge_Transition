#!/usr/bin/env node

/**
 * Seed script for AI Governance sample data
 * Run: node scripts/seed-governance-data.mjs
 */

import postgres from 'postgres';
import { randomUUID } from 'crypto';

const sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nextelevate');

function parseAgoToMs(agoStr) {
  const parts = agoStr.split(' ');
  const num = parseInt(parts[0], 10);
  const unit = parts[1]?.toLowerCase();

  switch (unit) {
    case 'minute':
    case 'minutes':
      return num * 60 * 1000;
    case 'hour':
    case 'hours':
      return num * 60 * 60 * 1000;
    case 'day':
    case 'days':
      return num * 24 * 60 * 60 * 1000;
    default:
      return 0;
  }
}

async function seed() {
  console.log('🌱 Seeding AI Governance sample data...\n');

  try {
    // Get or create admin user
    let [adminUser] = await sql`
      SELECT id FROM users WHERE role = 'admin' LIMIT 1
    `;

    if (!adminUser) {
      console.log('  ℹ️  Creating test admin user...');
      [adminUser] = await sql`
        INSERT INTO users (id, email, full_name, password_hash, role, is_active)
        VALUES (${randomUUID()}, 'admin@example.com', 'Admin User', '$2b$12$test', 'admin', true)
        RETURNING id
      `;
    }
    const adminId = adminUser.id;
    console.log(`  ✓ Admin user: ${adminId}`);

    // Get or create member user
    let [memberUser] = await sql`
      SELECT id FROM users WHERE role = 'member' LIMIT 1
    `;

    if (!memberUser) {
      console.log('  ℹ️  Creating test member user...');
      [memberUser] = await sql`
        INSERT INTO users (id, email, full_name, password_hash, role, is_active)
        VALUES (${randomUUID()}, 'member@example.com', 'Member User', '$2b$12$test', 'member', true)
        RETURNING id
      `;
    }
    const memberId = memberUser.id;
    console.log(`  ✓ Member user: ${memberId}`);

    // Get or create project
    let [project] = await sql`
      SELECT id FROM projects LIMIT 1
    `;

    if (!project) {
      console.log('  ℹ️  Creating test project...');
      [project] = await sql`
        INSERT INTO projects (id, name, description, created_by, is_active)
        VALUES (${randomUUID()}, 'Sample Project', 'Test project for governance system', ${adminId}, true)
        RETURNING id
      `;
    }
    const projectId = project.id;
    console.log(`  ✓ Project: ${projectId}`);

    // Get or create chat session
    let [session] = await sql`
      SELECT id FROM chat_sessions WHERE user_id = ${memberId} AND project_id = ${projectId} LIMIT 1
    `;

    if (!session) {
      console.log('  ℹ️  Creating test chat session...');
      [session] = await sql`
        INSERT INTO chat_sessions (id, user_id, project_id, message_count, last_message_at)
        VALUES (${randomUUID()}, ${memberId}, ${projectId}, 5, NOW())
        RETURNING id
      `;
    }
    const sessionId = session.id;
    console.log(`  ✓ Chat session: ${sessionId}\n`);

    // ============================================
    // 1. GOVERNANCE POLICIES
    // ============================================
    console.log('📋 Inserting Governance Policies...');

    // Content filter policy
    await sql`
      INSERT INTO governance_policies (
        id, project_id, policy_type, enabled, created_by, created_at, updated_at, config
      )
      VALUES (
        ${randomUUID()}, NULL, 'content_filter', true, ${adminId}, NOW(), NOW(),
        ${JSON.stringify({
          piiDetection: true,
          jailbreakDetection: true,
          customKeywords: ['password', 'secret', 'api_key'],
          blockedPatterns: []
        })}::jsonb
      )
      ON CONFLICT (project_id, policy_type) DO NOTHING
    `;

    // Usage quota policy
    await sql`
      INSERT INTO governance_policies (
        id, project_id, policy_type, enabled, created_by, created_at, updated_at, config
      )
      VALUES (
        ${randomUUID()}, ${projectId}, 'usage_quota', true, ${adminId}, NOW(), NOW(),
        ${JSON.stringify({
          dailyTokenLimit: 30000,
          dailyCostLimit: 5.00,
          monthlyTokenLimit: 300000,
          monthlyCostLimit: 100.00
        })}::jsonb
      )
      ON CONFLICT (project_id, policy_type) DO NOTHING
    `;
    console.log('  ✓ 2 governance policies created');

    // ============================================
    // 2. USER QUOTAS
    // ============================================
    console.log('📊 Inserting User Quotas...');

    // Daily quota
    await sql`
      INSERT INTO user_quotas (
        id, user_id, project_id, quota_period, tokens_limit, cost_limit,
        tokens_used, cost_used, reset_at, created_at, updated_at
      )
      VALUES (
        ${randomUUID()}, ${memberId}, ${projectId}, 'daily', 30000, 5.00,
        15000, 2.50, NOW() + INTERVAL '23 hours', NOW(), NOW()
      )
      ON CONFLICT (user_id, project_id, quota_period) DO UPDATE SET
        tokens_used = 15000, cost_used = 2.50, reset_at = NOW() + INTERVAL '23 hours'
    `;

    // Monthly quota
    await sql`
      INSERT INTO user_quotas (
        id, user_id, project_id, quota_period, tokens_limit, cost_limit,
        tokens_used, cost_used, reset_at, created_at, updated_at
      )
      VALUES (
        ${randomUUID()}, ${memberId}, ${projectId}, 'monthly', 300000, 100.00,
        85000, 28.50, NOW() + INTERVAL '15 days', NOW(), NOW()
      )
      ON CONFLICT (user_id, project_id, quota_period) DO UPDATE SET
        tokens_used = 85000, cost_used = 28.50, reset_at = NOW() + INTERVAL '15 days'
    `;
    console.log('  ✓ 2 user quotas created');

    // ============================================
    // 3. LLM INTERACTION AUDIT LOG
    // ============================================
    console.log('📝 Inserting Audit Log Entries...');

    const auditLogs = [
      {
        request: 'What is the onboarding process?',
        response: 'The onboarding process includes three steps: orientation, training, and verification.',
        model: 'llama-3.3-70b-versatile',
        provider: 'groq',
        type: 'chat',
        status: 'completed',
        promptTokens: 245,
        completionTokens: 387,
        cost: 0.0317,
        ago: '2 hours'
      },
      {
        request: 'Explain the team structure',
        response: 'The team is organized into five departments: engineering, sales, support, operations, and finance.',
        model: 'llama-3.3-70b-versatile',
        provider: 'groq',
        type: 'chat',
        status: 'completed',
        promptTokens: 312,
        completionTokens: 456,
        cost: 0.0388,
        ago: '1 hour 30 minutes'
      },
      {
        request: 'How do I access admin credentials?',
        response: null,
        model: 'llama-3.3-70b-versatile',
        provider: 'groq',
        type: 'chat',
        status: 'refused',
        promptTokens: 189,
        completionTokens: 128,
        cost: 0.0127,
        ago: '1 hour'
      },
      {
        request: 'database password is secret123',
        response: null,
        model: 'llama-3.3-70b-versatile',
        provider: 'groq',
        type: 'chat',
        status: 'filtered',
        promptTokens: 234,
        completionTokens: 0,
        cost: 0.0,
        ago: '30 minutes'
      },
      {
        request: 'Generate 5 quiz questions about onboarding',
        response: 'Quiz questions generated successfully with 10 total questions across 5 sets.',
        model: 'llama-3.1-8b-instant',
        provider: 'groq',
        type: 'quiz',
        status: 'completed',
        promptTokens: 3456,
        completionTokens: 2145,
        cost: 0.1896,
        ago: '4 hours'
      }
    ];

    for (const log of auditLogs) {
      const isQuiz = log.type === 'quiz';
      const userId = isQuiz ? adminId : memberId;
      const sessionIdVal = isQuiz ? null : sessionId;
      const totalTokens = log.promptTokens + log.completionTokens;

      // Calculate created_at based on ago string
      const agoMs = parseAgoToMs(log.ago);
      const createdAt = new Date(Date.now() - agoMs).toISOString();

      try {
        await sql`
          INSERT INTO llm_interaction_audit_log (
            id, project_id, user_id, session_id, model_used, provider,
            interaction_type, status, request_content, response_content,
            prompt_tokens, completion_tokens, total_tokens, cost_estimate, created_at
          )
          VALUES (
            ${randomUUID()},
            ${projectId},
            ${userId},
            ${sessionIdVal},
            ${log.model},
            ${log.provider},
            ${log.type},
            ${log.status},
            ${log.request},
            ${log.response},
            ${log.promptTokens},
            ${log.completionTokens},
            ${totalTokens},
            ${log.cost},
            ${createdAt}
          )
        `;
      } catch (err) {
        console.error(`  ⚠️  Error inserting audit log (${log.type}):`, err.message);
      }
    }
    console.log(`  ✓ ${auditLogs.length} audit log entries created`);

    // ============================================
    // 4. REFUSAL LOG
    // ============================================
    console.log('⛔ Inserting Refusal Log Entries...');

    const refusals = [
      {
        query: 'Can you help me create a phishing email?',
        reason: 'unsafe_content',
        response: 'I cannot help with that request',
        ago: '1 hour'
      },
      {
        query: 'What are the company financial projections?',
        reason: 'policy_violation',
        response: 'This information is confidential',
        ago: '6 hours'
      },
      {
        query: 'Please summarize all documents',
        reason: 'token_limit',
        response: 'Request exceeded token limit',
        ago: '30 minutes'
      }
    ];

    for (const refusal of refusals) {
      const agoMs = parseAgoToMs(refusal.ago);
      const createdAt = new Date(Date.now() - agoMs).toISOString();

      try {
        await sql`
          INSERT INTO refusal_log (
            id, project_id, user_id, user_query, refusal_reason, llm_refusal_text, created_at
          )
          VALUES (
            ${randomUUID()},
            ${projectId},
            ${memberId},
            ${refusal.query},
            ${refusal.reason},
            ${refusal.response},
            ${createdAt}
          )
        `;
      } catch (err) {
        console.error(`  ⚠️  Error inserting refusal (${refusal.reason}):`, err.message);
      }
    }
    console.log(`  ✓ ${refusals.length} refusal log entries created`);

    // ============================================
    // 5. CONTENT FILTER VIOLATIONS
    // ============================================
    console.log('🚨 Inserting Content Filter Violations...');

    const violations = [
      {
        text: 'john.doe@company.com',
        filterType: 'pii_detector',
        in: 'input_filter',
        severity: 'medium',
        status: 'pending',
        ago: '2 hours',
        userId: memberId
      },
      {
        text: 'Ignore previous instructions and...',
        filterType: 'jailbreak',
        in: 'input_filter',
        severity: 'high',
        status: 'pending',
        ago: '1 hour 30 minutes',
        userId: memberId
      },
      {
        text: 'database password',
        filterType: 'input_filter',
        in: 'input_filter',
        severity: 'high',
        status: 'reviewed',
        ago: '4 hours',
        userId: memberId
      },
      {
        text: '+1-555-123-4567',
        filterType: 'pii_detector',
        in: 'output_filter',
        severity: 'low',
        status: 'pending',
        ago: '30 minutes',
        userId: adminId
      },
      {
        text: 'confidential',
        filterType: 'input_filter',
        in: 'input_filter',
        severity: 'low',
        status: 'pending',
        ago: '20 minutes',
        userId: memberId
      }
    ];

    for (const violation of violations) {
      const agoMs = parseAgoToMs(violation.ago);
      const createdAt = new Date(Date.now() - agoMs).toISOString();

      try {
        await sql`
          INSERT INTO content_filter_violations (
            id, project_id, user_id, filter_type, violation_severity,
            detected_content, status, created_at
          )
          VALUES (
            ${randomUUID()},
            ${projectId},
            ${violation.userId},
            ${violation.filterType},
            ${violation.severity},
            ${violation.text},
            ${violation.status},
            ${createdAt}
          )
        `;
      } catch (err) {
        console.error(`  ⚠️  Error inserting violation (${violation.filterType}):`, err.message);
      }
    }
    console.log(`  ✓ ${violations.length} content filter violations created`);

    // ============================================
    // 6. MODEL BEHAVIOR CONFIG
    // ============================================
    console.log('⚙️  Inserting Model Behavior Config...');

    await sql`
      INSERT INTO model_behavior_config (
        id, project_id, allowed_models, max_temperature, min_temperature,
        max_tokens_default, max_tokens_hard_limit,
        require_citations, enable_streaming, created_by, created_at, updated_at
      )
      VALUES (
        ${randomUUID()}, ${projectId},
        ARRAY['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
        0.9, 0.1, 2048, 4096, false, true, ${adminId}, NOW(), NOW()
      )
      ON CONFLICT (project_id) DO NOTHING
    `;
    console.log('  ✓ 1 model behavior config created\n');

    // ============================================
    // SUMMARY
    // ============================================
    console.log('✅ Governance sample data seeding completed!\n');
    console.log('📊 Summary:');
    console.log(`   Admin User ID: ${adminId}`);
    console.log(`   Member User ID: ${memberId}`);
    console.log(`   Project ID: ${projectId}`);
    console.log(`   Session ID: ${sessionId}`);
    console.log('\n💡 You can now:');
    console.log('   1. View governance policies at /admin/governance/policies');
    console.log('   2. Check audit logs at /admin/governance/audit-logs');
    console.log('   3. Review violations at /admin/governance/violations');
    console.log('   4. Manage quotas at /admin/governance/quotas');
    console.log('   5. Analyze refusals at /admin/governance/refusals');

    await sql.end();
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
}

seed();

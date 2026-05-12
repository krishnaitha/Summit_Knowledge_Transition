import sql from '@/lib/db';

export async function checkRateLimit(
  userId: string,
  action: string,
  maxPerWindow: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const rows = await sql`
    SELECT COUNT(*) as c
    FROM activity_log
    WHERE user_id = ${userId} AND action = ${action} AND created_at >= ${since}
  `;

  const used = Number(rows[0]?.c ?? 0);
  const remaining = Math.max(0, maxPerWindow - used);
  return { allowed: used < maxPerWindow, remaining };
}

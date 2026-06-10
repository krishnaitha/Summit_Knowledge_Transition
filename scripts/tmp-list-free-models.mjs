const token = process.env.COPILOT_PROXY_TOKEN;
const res = await fetch('https://models.github.ai/catalog/models', {
  headers: { Authorization: `Bearer ${token}` },
});
const models = await res.json();
const low = models.filter((m) => m.rate_limit_tier === 'low').map((m) => m.id).sort();
console.log(JSON.stringify(low, null, 2));
console.error('count', low.length);

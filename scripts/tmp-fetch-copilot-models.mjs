const token = process.env.COPILOT_PROXY_TOKEN;
const url = 'https://models.github.ai/catalog/models';

const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});

console.log('status', res.status);
const body = await res.text();
console.log(body.slice(0, 2000));

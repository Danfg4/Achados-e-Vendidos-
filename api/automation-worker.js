export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(500).json({ ok: false, error: 'Missing server configuration' });
  const headers = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  try {
    const response = await fetch(url + '/functions/v1/automation-worker', { method: 'POST', headers, body: '{}' });
    const text = await response.text();
    return res.status(response.ok ? 200 : 502).json({ ok: response.ok, stage: 'worker', status: response.status, result: text, publishing_enabled: false });
  } catch (error) {
    return res.status(502).json({ ok: false, stage: 'worker', error: String(error) });
  }
}

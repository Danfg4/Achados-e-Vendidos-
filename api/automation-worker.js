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
  const jobs = [];
  try {
    for (let i = 0; i < 20; i++) {
      const response = await fetch(url + '/functions/v1/automation-worker', { method: 'POST', headers, body: '{}' });
      const raw = await response.text();
      let result;
      try { result = JSON.parse(raw); } catch { result = { raw }; }
      if (!response.ok) return res.status(502).json({ ok: false, stage: 'worker', status: response.status, result, processed_jobs: jobs.length });
      if (result.claimed === false || (result.claimed === undefined && result.job_id === undefined)) break;
      jobs.push({ job_id: result.job_id ?? null, action: result.action ?? result.next ?? result.status ?? 'processed', ok: result.ok !== false });
      if (result.ok === false) break;
    }
    return res.status(200).json({ ok: true, stage: 'worker', processed_jobs: jobs.length, jobs, publishing_enabled: false });
  } catch (error) {
    return res.status(502).json({ ok: false, stage: 'worker', error: String(error), processed_jobs: jobs.length });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ ok: false, error: 'Missing server configuration' });
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };

  const callFunction = async (slug) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/${slug}`, {
      method: 'POST',
      headers,
      body: '{}'
    });
    const raw = await response.text();
    let result;
    try { result = JSON.parse(raw); } catch { result = { raw }; }
    if (!response.ok) {
      const error = new Error(`${slug} returned HTTP ${response.status}`);
      error.status = response.status;
      error.details = result;
      throw error;
    }
    return result;
  };

  const jobs = [];
  try {
    // Process a bounded batch so this scheduled request stays within serverless limits.
    for (let i = 0; i < 8; i++) {
      const result = await callFunction('automation-worker');
      if (result.claimed === false) break;
      if (result.claimed !== true) {
        throw new Error('automation-worker returned an unexpected response');
      }
      jobs.push({
        job_id: result.job_id ?? null,
        action: result.action ?? result.next ?? result.status ?? 'processed',
        ok: result.ok !== false
      });
      if (result.ok === false) break;
    }

    // A job may have produced Facebook and Instagram drafts; publish only through
    // the guarded Meta function, which independently checks the opt-in flag,
    // credentials, product eligibility, HTTPS image and affiliate URL.
    const publishing = await callFunction('publish-affiliate-posts');
    const ok = publishing.ok !== false && jobs.every((job) => job.ok);

    return res.status(ok ? 200 : 502).json({
      ok,
      stage: 'process_and_publish',
      processed_jobs: jobs.length,
      jobs,
      publishing,
      publishing_enabled: publishing.publishing_enabled === true
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      stage: 'worker_or_publish',
      error: error instanceof Error ? error.message : String(error),
      status: error && typeof error === 'object' && 'status' in error ? error.status : undefined,
      details: error && typeof error === 'object' && 'details' in error ? error.details : undefined,
      processed_jobs: jobs.length
    });
  }
}

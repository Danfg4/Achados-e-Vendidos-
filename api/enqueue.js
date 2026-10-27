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
    let data;
    try { data = JSON.parse(raw); } catch { data = { raw }; }
    if (!response.ok) {
      const error = new Error(`${slug} returned HTTP ${response.status}`);
      error.status = response.status;
      error.details = data;
      throw error;
    }
    return data;
  };

  try {
    const enqueueResult = await callFunction('enqueue-affiliate-jobs');
    const processed = [];

    // Keep the batch short enough for a single daily serverless cron execution.
    for (let i = 0; i < 8; i++) {
      const result = await callFunction('automation-worker');
      if (result.claimed === false) break;
      if (result.claimed !== true) {
        throw new Error('automation-worker returned an unexpected response');
      }
      processed.push({
        job_id: result.job_id ?? null,
        action: result.action ?? result.next ?? result.status ?? 'processed',
        ok: result.ok !== false
      });
      if (result.ok === false) break;
    }

    const publishing = await callFunction('publish-affiliate-posts');
    return res.status(200).json({
      ok: true,
      stage: 'enqueue_process_and_publish',
      enqueue: enqueueResult,
      processed_jobs: processed.length,
      jobs: processed,
      publishing,
      publishing_enabled: publishing.publishing_enabled === true
    });
  } catch (error) {
    return res.status(502).json({
      ok: false,
      stage: 'automation',
      error: error instanceof Error ? error.message : String(error),
      status: error && typeof error === 'object' && 'status' in error ? error.status : undefined,
      details: error && typeof error === 'object' && 'details' in error ? error.details : undefined
    });
  }
}

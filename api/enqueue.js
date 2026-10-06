export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      ok: false,
      error: 'Method not allowed'
    });
  }

  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization || '';

  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized'
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      ok: false,
      error: 'Missing server configuration'
    });
  }

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json'
  };

  try {
    const enqueue = await fetch(
      `${supabaseUrl}/functions/v1/enqueue-affiliate-jobs`,
      {
        method: 'POST',
        headers,
        body: '{}'
      }
    );

    const enqueueText = await enqueue.text();

    if (!enqueue.ok) {
      return res.status(502).json({
        ok: false,
        stage: 'enqueue',
        error: enqueueText
      });
    }

    return res.status(200).json({
      ok: true,
      stage: 'enqueue',
      result: enqueueText
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ detail: 'Use POST' })
  }

  try {
    const auth = req.headers.authorization || ''
    const bearer =
      auth.toLowerCase().startsWith('bearer ') ? auth.slice('bearer '.length).trim() : process.env.MUREKA_API_KEY || ''
    if (!bearer) {
      return res.status(401).json({
        detail: 'Missing Mureka API key (env MUREKA_API_KEY or Authorization: Bearer ...)',
      })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}
    const lyrics = String(body.lyrics || '').trim()
    const style = String(body.style || body.prompt || 'pop').trim()
    if (!lyrics) {
      return res.status(400).json({ detail: 'Missing lyrics' })
    }

    const upstream = await fetch('https://api.mureka.ai/v1/song/generate', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bearer}`,
        'User-Agent': 'Dieter-Music/1.0',
      },
      body: JSON.stringify({
        ...body,
        lyrics,
        prompt: body.prompt || style,
      }),
    })

    const text = await upstream.text()
    let json = {}
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      /* keep empty object */
    }

    const taskId = String(json.task_id || json.id || json.taskId || '').trim()
    if (!upstream.ok) {
      return res.status(upstream.status).json(json && typeof json === 'object' ? json : { detail: text || 'Upstream error' })
    }

    return res.status(200).json({
      ...json,
      taskId,
    })
  } catch (e) {
    console.error('Mureka generate error:', e)
    return res.status(500).json({ detail: String(e?.message || e) })
  }
}


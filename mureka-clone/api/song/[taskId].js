export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ detail: 'Use GET' })
  }

  const { taskId } = req.query || {}
  const tid = String(taskId || '').trim()
  if (!tid) {
    return res.status(400).json({ detail: 'Missing taskId' })
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

    const upstream = await fetch(`https://api.mureka.ai/v1/song/query/${encodeURIComponent(tid)}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${bearer}`,
        'User-Agent': 'Dieter-Music/1.0',
      },
    })

    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', 'application/json')
    return res.send(text || '{}')
  } catch (e) {
    console.error('Mureka query error:', e)
    return res.status(500).json({ detail: String(e?.message || e) })
  }
}


export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ detail: 'Use POST' })
    return
  }

  try {
    const auth = req.headers.authorization || ''
    const bearer =
      auth.toLowerCase().startsWith('bearer ') ? auth.slice('bearer '.length).trim() : process.env.MUREKA_API_KEY || ''
    if (!bearer) {
      res.status(401).json({ detail: 'Missing Mureka API key (set MUREKA_API_KEY in Vercel or send Authorization: Bearer …)' })
      return
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
    const upstream = await fetch('https://api.mureka.ai/v1/song/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${bearer}`,
      },
      body: JSON.stringify(body),
    })
    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', 'application/json')
    res.send(text || '{}')
  } catch (e) {
    res.status(500).json({ detail: String(e?.message || e) })
  }
}


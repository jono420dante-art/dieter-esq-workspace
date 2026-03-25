export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ detail: 'Use GET' })
    return
  }

  const { taskId } = req.query || {}
  const tid = String(taskId || '').trim()
  if (!tid) {
    res.status(400).json({ detail: 'Missing taskId' })
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

    const upstream = await fetch(`https://api.mureka.ai/v1/song/query/${encodeURIComponent(tid)}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${bearer}` },
    })
    const text = await upstream.text()
    res.status(upstream.status)
    res.setHeader('Content-Type', 'application/json')
    res.send(text || '{}')
  } catch (e) {
    res.status(500).json({ detail: String(e?.message || e) })
  }
}


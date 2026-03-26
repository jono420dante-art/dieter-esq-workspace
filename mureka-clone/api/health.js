export default async function handler(_req, res) {
  res.status(200).json({
    ok: true,
    mode: 'vercel-serverless',
    murekaProxy: true,
    hasServerKey: Boolean((process.env.MUREKA_API_KEY || '').trim()),
    time: Date.now(),
  })
}


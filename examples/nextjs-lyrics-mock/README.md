# Next.js mock: `POST /api/lyrics/generate`

1. Copy `app/api/lyrics/generate/route.js` into your Next.js project (App Router, Next 13+).
2. Put `public/demo-song.mp3` if you want a real file at `song_url`, or change `song_url` to any public URL.
3. Call from the client: `fetch('/api/lyrics/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lyrics: '...' }) })`.

No `OPENAI_API_KEY` required for this mock.

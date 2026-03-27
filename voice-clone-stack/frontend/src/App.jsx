import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8001'

export default function App() {
  const [voices, setVoices] = useState([])
  const [voiceId, setVoiceId] = useState('')
  const [text, setText] = useState('We rise tonight and sing with power.')
  const [audioUrl, setAudioUrl] = useState('')
  const [msg, setMsg] = useState('')

  const loadVoices = async () => {
    const r = await fetch(`${API_BASE}/api/voices`)
    const j = await r.json()
    setVoices(j.voices || [])
  }

  useEffect(() => {
    void loadVoices()
  }, [])

  const synth = async () => {
    setMsg('')
    setAudioUrl('')
    const fd = new FormData()
    fd.set('voice_id', voiceId)
    fd.set('text', text)
    const r = await fetch(`${API_BASE}/api/synthesize`, { method: 'POST', body: fd })
    const j = await r.json()
    if (!r.ok) {
      setMsg(j.detail || 'Synthesis failed')
      return
    }
    setAudioUrl(`${API_BASE}${j.audioUrl}`)
  }

  return (
    <main style={{ maxWidth: 720, margin: '2rem auto', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Voice Clone Stack</h1>
      <p>Register a voice in backend, then synthesize text.</p>
      <label>Voice ID</label>
      <input
        style={{ display: 'block', width: '100%', marginBottom: 12 }}
        value={voiceId}
        onChange={(e) => setVoiceId(e.target.value)}
        placeholder="e.g. male_main"
        list="voice-list"
      />
      <datalist id="voice-list">
        {voices.map((v) => (
          <option key={v.voiceId} value={v.voiceId} />
        ))}
      </datalist>

      <label>Text</label>
      <textarea
        style={{ display: 'block', width: '100%', minHeight: 120, marginBottom: 12 }}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button onClick={synth}>Synthesize</button>
      {msg && <p style={{ color: 'crimson' }}>{msg}</p>}
      {audioUrl && <audio style={{ display: 'block', marginTop: 16, width: '100%' }} controls src={audioUrl} />}
    </main>
  )
}

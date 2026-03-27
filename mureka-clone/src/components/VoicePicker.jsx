import { useCallback, useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { trpc } from '../trpc.js'
import { normalizeApiRoot } from '../apiResolve.js'

/**
 * Sample voice library: FastAPI ``GET /api/voices/list`` + static ``/voices/...``.
 * tRPC: ``trpc.voicesList.query()`` (same data). Upload: multipart ``POST /api/voices/upload``.
 */
export default function VoicePicker({ onVoiceSelect }) {
  const containerRef = useRef(null)
  const wsRef = useRef(null)
  const [voices, setVoices] = useState({ man: [], woman: [] })
  const [err, setErr] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)

  const loadList = useCallback(async () => {
    setErr('')
    try {
      const data = await trpc.voicesList.query()
      setVoices({ man: data.man || [], woman: data.woman || [] })
    } catch (e) {
      const api = normalizeApiRoot(import.meta.env.VITE_API_BASE || '/api')
      const r = await fetch(`${api}/voices/list`)
      if (!r.ok) throw new Error(await r.text())
      const data = await r.json()
      setVoices({ man: data.man || [], woman: data.woman || [] })
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const ws = WaveSurfer.create({
      container: el,
      waveColor: '#4F46E5',
      progressColor: '#EC4899',
      height: 60,
      barWidth: 2,
    })
    wsRef.current = ws
    return () => {
      ws.destroy()
      wsRef.current = null
    }
  }, [])

  const playVoice = (url) => {
    const ws = wsRef.current
    if (!ws) return
    ws.load(url)
    ws.once('ready', () => {
      ws.play()
    })
    onVoiceSelect?.(url)
  }

  const onUpload = async (e, category) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadBusy(true)
    setErr('')
    try {
      const api = normalizeApiRoot(import.meta.env.VITE_API_BASE || '/api')
      const fd = new FormData()
      fd.append('category', category)
      fd.append('file', file)
      const r = await fetch(`${api}/voices/upload`, { method: 'POST', body: fd })
      if (!r.ok) throw new Error(await r.text())
      const j = await r.json()
      await loadList()
      playVoice(j.url)
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex))
    } finally {
      setUploadBusy(false)
      e.target.value = ''
    }
  }

  return (
    <div className="voice-picker glassmorphism p-6 rounded-2xl" style={{ maxWidth: 520 }}>
      <h3 className="text-xl font-bold mb-4 text-purple-400">Real Voices</h3>
      {err ? (
        <p className="text-sm text-red-400 mb-2" role="alert">
          {err}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {(voices.man || []).map((voice, i) => (
          <button
            key={`m-${voice.name}-${i}`}
            type="button"
            className="voice-btn bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-2 rounded-xl hover:from-blue-600"
            onClick={() => playVoice(voice.url)}
          >
            {voice.name.slice(0, 22)}
          </button>
        ))}
        {(voices.woman || []).map((voice, i) => (
          <button
            key={`w-${voice.name}-${i}`}
            type="button"
            className="voice-btn bg-gradient-to-r from-pink-500 to-purple-600 text-white px-4 py-2 rounded-xl hover:from-pink-600"
            onClick={() => playVoice(voice.url)}
          >
            {voice.name.slice(0, 22)}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="w-full min-h-[60px] bg-gray-900 rounded-lg mb-4" />
      <div className="flex flex-wrap gap-2 text-sm">
        <label className="cursor-pointer text-gray-300">
          Upload (man){' '}
          <input
            type="file"
            accept=".wav,audio/wav"
            className="hidden"
            disabled={uploadBusy}
            onChange={(ev) => onUpload(ev, 'man')}
          />
        </label>
        <label className="cursor-pointer text-gray-300">
          Upload (woman){' '}
          <input
            type="file"
            accept=".wav,audio/wav"
            className="hidden"
            disabled={uploadBusy}
            onChange={(ev) => onUpload(ev, 'woman')}
          />
        </label>
      </div>
    </div>
  )
}

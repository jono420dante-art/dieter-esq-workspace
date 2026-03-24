import { useEffect, useRef } from 'react'

export function useBeatVisualizer(audioRef, canvasRef, audioUrl) {
  const rafRef = useRef(0)
  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const connectedRef = useRef(false)

  useEffect(() => {
    if (!audioUrl) return undefined
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx2d = canvas.getContext('2d')

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.max(1, Math.floor(r.width * dpr))
      canvas.height = Math.max(1, Math.floor(160 * dpr))
    }
    resize()
    window.addEventListener('resize', resize)

    let data = new Uint8Array(128)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const W = canvas.width
      const H = canvas.height
      const analyser = analyserRef.current
      if (!analyser) {
        ctx2d.fillStyle = 'rgb(24,24,32)'
        ctx2d.fillRect(0, 0, W, H)
        ctx2d.fillStyle = 'rgba(167,139,250,.4)'
        ctx2d.font = '12px system-ui,sans-serif'
        ctx2d.fillText('Press play on the audio player', 10, 28)
        return
      }
      if (data.length !== analyser.frequencyBinCount) {
        data = new Uint8Array(analyser.frequencyBinCount)
      }
      analyser.getByteFrequencyData(data)
      ctx2d.fillStyle = 'rgb(15,15,22)'
      ctx2d.fillRect(0, 0, W, H)
      const n = data.length
      const barW = (W / n) * 2.5
      let x = 0
      for (let i = 0; i < n; i++) {
        const v = data[i]
        const bh = (v / 255) * H
        ctx2d.fillStyle = `rgb(${Math.min(255, v + 80)}, ${Math.min(200, v)}, 180)`
        ctx2d.fillRect(x, H - bh, barW, bh)
        x += barW + 1
        if (x > W) break
      }
    }
    draw()

    const audioEl = audioRef.current
    const onPlay = async () => {
      if (!audioEl) return
      if (!connectedRef.current) {
        try {
          const actx = new (window.AudioContext || window.webkitAudioContext)()
          audioCtxRef.current = actx
          const src = actx.createMediaElementSource(audioEl)
          const analyser = actx.createAnalyser()
          analyser.fftSize = 256
          analyserRef.current = analyser
          src.connect(analyser)
          analyser.connect(actx.destination)
          connectedRef.current = true
        } catch (e) {
          console.warn('Web Audio:', e)
        }
      }
      if (audioCtxRef.current?.state === 'suspended') await audioCtxRef.current.resume()
    }
    const tid = setTimeout(() => {
      if (audioEl) audioEl.addEventListener('play', onPlay)
    }, 0)

    return () => {
      clearTimeout(tid)
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(rafRef.current)
      audioEl?.removeEventListener('play', onPlay)
      try {
        audioCtxRef.current?.close()
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null
      analyserRef.current = null
      connectedRef.current = false
    }
  }, [audioUrl, audioRef, canvasRef])
}

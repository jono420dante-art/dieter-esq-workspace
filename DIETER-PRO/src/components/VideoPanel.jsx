import { useRef, useEffect, useCallback, useState } from 'react';
import { useVideo } from '../context/VideoContext';
import { useAudioEngine } from '../context/AudioEngineContext';

const AI_STYLES = ['particles', 'bars', 'rings', 'warp', 'matrix'];

export default function VideoPanel() {
  const { aiStyle, setAiStyle, aiIntensity, aiColorHue, aiBeatReact, setAiParam, beats, isGenerating, dispatch } = useVideo();
  const { analyserRef, isReady } = useAudioEngine();
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const particlesRef = useRef([]);
  const [recording, setRecording] = useState(false);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.parentElement?.clientWidth || 400;
    const h = canvas.parentElement?.clientHeight || 225;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let energy = 0;
    if (analyserRef?.current) {
      const fd = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(fd);
      for (let i = 0; i < fd.length; i++) energy += fd[i];
      energy = (energy / fd.length / 255) * (aiBeatReact / 100);
    }

    const intensity = aiIntensity / 100;
    const hue = aiColorHue;

    ctx.fillStyle = `rgba(6, 6, 12, ${0.15 + energy * 0.1})`;
    ctx.fillRect(0, 0, w, h);

    if (aiStyle === 'particles') {
      if (particlesRef.current.length === 0) {
        particlesRef.current = Array.from({ length: 150 }, () => ({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2,
          r: Math.random() * 3 + 1, life: Math.random(),
        }));
      }
      particlesRef.current.forEach((p) => {
        p.x += p.vx * (1 + energy * 6) * intensity;
        p.y += p.vy * (1 + energy * 6) * intensity;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
        p.life -= 0.003;
        if (p.life <= 0) { p.x = w / 2; p.y = h / 2; p.vx = (Math.random() - 0.5) * 4; p.vy = (Math.random() - 0.5) * 4; p.life = 1; }
        ctx.beginPath();
        ctx.fillStyle = `hsla(${hue + p.life * 60}, 80%, ${50 + energy * 30}%, ${p.life})`;
        ctx.arc(p.x, p.y, p.r * (1 + energy * 3), 0, Math.PI * 2);
        ctx.fill();
      });
    } else if (aiStyle === 'bars') {
      const bars = 48;
      const barW = w / bars;
      const fd = analyserRef?.current ? new Uint8Array(analyserRef.current.frequencyBinCount) : null;
      if (fd) analyserRef.current.getByteFrequencyData(fd);
      for (let i = 0; i < bars; i++) {
        const val = fd ? fd[Math.floor(i * fd.length / bars)] / 255 : Math.random() * 0.3;
        const barH = val * h * intensity;
        ctx.fillStyle = `hsla(${hue + i * 4}, 75%, 55%, 0.8)`;
        ctx.fillRect(i * barW, h - barH, barW - 1, barH);
      }
    } else if (aiStyle === 'rings') {
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < 8; i++) {
        const r = ((i + 1) / 8) * Math.min(w, h) / 2 * (1 + energy * 0.5);
        ctx.beginPath();
        ctx.strokeStyle = `hsla(${hue + i * 30}, 70%, 55%, ${0.5 - i * 0.05})`;
        ctx.lineWidth = 2 + energy * 6;
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (aiStyle === 'warp') {
      const cx = w / 2, cy = h / 2;
      for (let i = 0; i < 40; i++) {
        const angle = (i / 40) * Math.PI * 2 + performance.now() * 0.001;
        const len = (0.3 + energy * 0.7) * Math.min(w, h) / 2 * intensity;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
        ctx.strokeStyle = `hsla(${hue + i * 7}, 80%, 60%, ${0.4 + energy * 0.4})`;
        ctx.lineWidth = 1 + energy * 2;
        ctx.stroke();
      }
    } else if (aiStyle === 'matrix') {
      ctx.font = '10px monospace';
      ctx.fillStyle = `hsla(${hue}, 80%, 60%, ${0.3 + energy * 0.3})`;
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * w;
        const y = Math.random() * h;
        ctx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), x, y);
      }
    }

    if (isGenerating) {
      animRef.current = requestAnimationFrame(drawFrame);
    }
  }, [aiStyle, aiIntensity, aiColorHue, aiBeatReact, isGenerating, analyserRef, beats]);

  useEffect(() => {
    if (isGenerating) {
      drawFrame();
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [isGenerating, drawFrame]);

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="panel-header">
        <span className="panel-title">🎬 AI Video</span>
        <span className="panel-badge">{isGenerating ? 'Generating...' : 'Idle'}</span>
      </div>

      <div style={{ position: 'relative', background: '#06060c', borderRadius: 8, aspectRatio: '16/9', overflow: 'hidden' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        {!isGenerating && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '2rem' }}>🎬</span>
            <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>Click Generate to start</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
        {AI_STYLES.map((s) => (
          <button key={s} className={`tag${aiStyle === s ? ' active' : ''}`} onClick={() => setAiStyle(s)} style={{ textTransform: 'capitalize' }}>{s}</button>
        ))}
      </div>

      <div className="slider-row"><label>Intensity</label><input type="range" min={1} max={100} value={aiIntensity} onChange={(e) => setAiParam('aiIntensity', +e.target.value)} /><span className="val">{aiIntensity}%</span></div>
      <div className="slider-row"><label>Color</label><input type="range" min={0} max={360} value={aiColorHue} onChange={(e) => setAiParam('aiColorHue', +e.target.value)} /><span className="val">{aiColorHue}°</span></div>
      <div className="slider-row"><label>Beat React</label><input type="range" min={0} max={100} value={aiBeatReact} onChange={(e) => setAiParam('aiBeatReact', +e.target.value)} /><span className="val">{aiBeatReact}%</span></div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-purple btn-sm" onClick={() => dispatch({ type: 'SET_GENERATING', value: !isGenerating })}>
          {isGenerating ? '■ Stop' : '⚡ Generate'}
        </button>
        <button className="btn btn-blue btn-sm" disabled={!isGenerating}>
          ⬇ Export WebM
        </button>
      </div>
    </div>
  );
}

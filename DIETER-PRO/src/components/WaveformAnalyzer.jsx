import { useRef, useEffect, useCallback } from 'react';
import { useAudioEngine } from '../context/AudioEngineContext';

export default function WaveformAnalyzer({ buffer, width = 600, height = 120, color = '#a855f7', style }) {
  const canvasRef = useRef(null);
  const { analyserRef, isReady, ensureRunning } = useAudioEngine();
  const animRef = useRef(null);

  const drawStatic = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const data = buffer.getChannelData(0);
    const step = Math.max(1, Math.floor(data.length / width));
    const mid = height / 2;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = `${color}44`;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let x = 0; x < width; x++) {
      const idx = x * step;
      let min = 0, max = 0;
      for (let j = 0; j < step; j++) {
        const s = data[idx + j] || 0;
        if (s < min) min = s;
        if (s > max) max = s;
      }
      ctx.fillRect(x, mid + min * mid, 1, (max - min) * mid || 1);
    }
    ctx.stroke();
  }, [buffer, width, height, color]);

  const drawLive = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef?.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const freqData = new Uint8Array(analyser.frequencyBinCount);

    function frame() {
      analyser.getByteFrequencyData(freqData);
      ctx.clearRect(0, 0, width, height);
      const barW = width / freqData.length * 2.5;

      for (let i = 0; i < freqData.length / 2.5; i++) {
        const v = freqData[i] / 255;
        const barH = v * height;
        const hue = 270 + i * 0.5;
        ctx.fillStyle = `hsla(${hue}, 80%, 55%, ${0.5 + v * 0.5})`;
        ctx.fillRect(i * barW, height - barH, barW - 1, barH);
      }
      animRef.current = requestAnimationFrame(frame);
    }

    frame();
    return () => cancelAnimationFrame(animRef.current);
  }, [analyserRef, width, height]);

  useEffect(() => {
    if (buffer) {
      drawStatic();
    } else if (isReady) {
      const cleanup = drawLive();
      return cleanup;
    }
  }, [buffer, isReady, drawStatic, drawLive]);

  return (
    <canvas
      ref={canvasRef}
      role="presentation"
      onClick={() => void ensureRunning()}
      title="Click to unlock audio meter"
      style={{
        width: '100%',
        height: height,
        borderRadius: 8,
        background: 'rgba(18, 22, 42, 0.5)',
        display: 'block',
        cursor: 'pointer',
        ...style,
      }}
    />
  );
}

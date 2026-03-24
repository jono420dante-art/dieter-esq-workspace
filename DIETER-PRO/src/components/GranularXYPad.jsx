import { useRef, useCallback, useEffect, useState } from 'react';
import { useGranular } from '../context/GranularContext';

export default function GranularXYPad({ size = 240 }) {
  const { xyX, xyY, setXY, setParam } = useGranular();
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const s = size;
    canvas.width = s * dpr;
    canvas.height = s * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cx = s / 2, cy = s / 2, r = s / 2 - 4;

    ctx.clearRect(0, 0, s, s);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18, 22, 42, 0.9)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    for (let i = 1; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, (r * i) / 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(168, 85, 247, ${0.08 * i})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.1)';
    ctx.stroke();

    const px = cx + (xyX - 0.5) * 2 * r;
    const py = cy + (0.5 - xyY) * 2 * r;

    const grad = ctx.createRadialGradient(px, py, 0, px, py, 30);
    grad.addColorStop(0, 'rgba(168, 85, 247, 0.3)');
    grad.addColorStop(1, 'rgba(168, 85, 247, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(px - 30, py - 30, 60, 60);

    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#a855f7';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(168, 85, 247, 0.6)';
    ctx.font = '9px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('POSITION', cx, cy + r + 14);
    ctx.save();
    ctx.translate(cx - r - 14, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('DENSITY', 0, 0);
    ctx.restore();
  }, [xyX, xyY, size]);

  useEffect(() => { draw(); }, [draw]);

  const handlePointer = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const s = size;
    const cx = s / 2, cy = s / 2, r = s / 2 - 4;
    const mx = (e.clientX - rect.left) / rect.width * s;
    const my = (e.clientY - rect.top) / rect.height * s;
    const dx = mx - cx, dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > r) return;
    const x = Math.max(0, Math.min(1, 0.5 + dx / (2 * r)));
    const y = Math.max(0, Math.min(1, 0.5 - dy / (2 * r)));
    setXY(x, y);
    setParam('position', x);
    setParam('density', 1 + y * 49);
  }, [setXY, setParam, size]);

  const onDown = useCallback((e) => {
    setDragging(true);
    handlePointer(e);
  }, [handlePointer]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => handlePointer(e);
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, handlePointer]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <canvas
        ref={canvasRef}
        onPointerDown={onDown}
        style={{ width: size, height: size, cursor: 'crosshair', touchAction: 'none' }}
      />
      <div style={{ fontSize: '0.58rem', color: '#6b7280', display: 'flex', gap: 12 }}>
        <span>X: {(xyX * 100).toFixed(0)}%</span>
        <span>Y: {(xyY * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

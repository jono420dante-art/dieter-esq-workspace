import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import VocalBox from "./VocalBox.jsx";

const apiBase = () => (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

function formatTime(s) {
  if (s == null || !Number.isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function App() {
  const base = useMemo(() => apiBase(), []);

  const [meta, setMeta] = useState(null);
  const [voices, setVoices] = useState(null);
  const [metaErr, setMetaErr] = useState("");

  const [tab, setTab] = useState("vocalbox");

  const [lyrics, setLyrics] = useState(
    `[Verse]
Hold the line — we turn the spark into a song.

[Chorus]
Every word you type becomes a melody we belong.`,
  );
  const [lang, setLang] = useState("en");
  const [autoLang, setAutoLang] = useState(false);
  const [voicePreset, setVoicePreset] = useState("v2/en_speaker_6");
  const [rvcModel, setRvcModel] = useState("");
  const [f0Generate, setF0Generate] = useState(0);
  const [pipelineRvc, setPipelineRvc] = useState("");
  const [mixWithBeat, setMixWithBeat] = useState(true);
  const [pipelineInfo, setPipelineInfo] = useState(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [rvcConvert, setRvcConvert] = useState("");
  const [f0Convert, setF0Convert] = useState(0);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastPipeline, setLastPipeline] = useState("");

  const [audioUrl, setAudioUrl] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef(null);
  const lyricsFileRef = useRef(null);
  const uploadRef = useRef(null);
  const polishRef = useRef(null);
  const beatStudioRef = useRef(null);
  const waveMountRef = useRef(null);
  const waveSurferRef = useRef(null);

  const refreshMeta = useCallback(async () => {
    setMetaErr("");
    try {
      const [m, v] = await Promise.all([
        fetch(`${base}/api/meta`).then((r) => r.json()),
        fetch(`${base}/api/voices`).then((r) => r.json()),
      ]);
      setMeta(m);
      setVoices(v);
    } catch (e) {
      setMetaErr(e.message || "Cannot reach API. Is the backend running?");
      setMeta(null);
      setVoices(null);
    }
  }, [base]);

  useEffect(() => {
    refreshMeta();
  }, [refreshMeta]);

  useEffect(() => {
    if (!meta || !voices?.bark_presets?.length) return;
    setVoicePreset((prev) => {
      if (prev === "") return "";
      if (voices.bark_presets.some((p) => p.id === prev)) return prev;
      return voices.bark_presets[6]?.id || voices.bark_presets[0].id;
    });
  }, [meta, voices]);

  useEffect(() => {
    if (!voices?.rvc_models?.length) return;
    setRvcConvert((prev) => prev || voices.rvc_models[0].id);
    setPipelineRvc((prev) => prev || voices.rvc_models[0].id);
  }, [voices]);

  useEffect(() => {
    const mount = waveMountRef.current;
    const media = audioRef.current;
    if (!audioUrl || !mount || !media) return;

    waveSurferRef.current?.destroy();
    waveSurferRef.current = null;

    const ws = WaveSurfer.create({
      container: mount,
      height: 72,
      waveColor: "rgba(129, 140, 248, 0.35)",
      progressColor: "rgb(34, 211, 238)",
      cursorColor: "rgba(248, 250, 252, 0.5)",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      media,
      interact: true,
    });
    waveSurferRef.current = ws;
    return () => {
      ws.destroy();
      waveSurferRef.current = null;
    };
  }, [audioUrl]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(a.currentTime);
    const onDur = () => setDuration(a.duration || 0);
    const onEnded = () => setPlaying(false);
    a.addEventListener("play", onPlay);
    a.addEventListener("pause", onPause);
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("durationchange", onDur);
    a.addEventListener("ended", onEnded);
    return () => {
      a.removeEventListener("play", onPlay);
      a.removeEventListener("pause", onPause);
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("durationchange", onDur);
      a.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const revokeAndSetUrl = useCallback((url) => {
    setAudioUrl((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return url;
    });
  }, []);

  const parseError = (data, res) => {
    const d = data?.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => x.msg || JSON.stringify(x)).join("; ");
    return res.statusText || "Request failed";
  };

  const loadResultFromResponse = async (res, opts = {}) => {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(parseError(data, res));
    const preferMix = opts.preferMix && data.mix_download;
    const rel = preferMix
      ? data.mix_download
      : data.download_url || data.vocal_download || data.mix_download;
    if (!rel) throw new Error("No download URL in API response");
    const url = `${base}${rel}`;
    revokeAndSetUrl(url);
    setLastPipeline(data.pipeline || "");
    setPlaying(false);
    setPipelineInfo(data.bpm != null ? data : null);
    setTimeout(() => {
      audioRef.current?.load?.();
    }, 0);
  };

  async function onGenerate(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const vp = (voicePreset || "").trim();
      const body = {
        lyrics: lyrics.trim(),
        lang,
        voice_preset: vp || null,
        f0_up_key: f0Generate,
        use_music_notes: true,
        auto_lang_detect: autoLang,
      };
      const rm = (rvcModel || "").trim();
      if (rm) body.rvc_model = rm;

      const res = await fetch(`${base}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await loadResultFromResponse(res);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onConvert(e) {
    e.preventDefault();
    if (!uploadFile) {
      setError("Choose a .wav file.");
      return;
    }
    if (!(voices?.rvc_available) || !((rvcConvert || "").trim())) {
      setError("Pick an RVC model and ensure RVC is installed on the server.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("rvc_model", (rvcConvert || "").trim());
      fd.append("f0_up_key", String(f0Convert));
      const res = await fetch(`${base}/api/convert`, { method: "POST", body: fd });
      await loadResultFromResponse(res);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onPolish(e) {
    e.preventDefault();
    const file = polishRef.current?.files?.[0];
    if (!file) {
      setError("Choose a .wav to polish.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${base}/api/polish`, { method: "POST", body: fd });
      await loadResultFromResponse(res);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onFullStudio(e) {
    e.preventDefault();
    const beat = beatStudioRef.current?.files?.[0];
    if (!beat) {
      setError("Choose a backing beat (.wav).");
      return;
    }
    setError("");
    setBusy(true);
    setPipelineInfo(null);
    try {
      const fd = new FormData();
      fd.append("beat", beat);
      fd.append("lyrics", lyrics.trim());
      fd.append("lang", lang);
      fd.append("voice_preset", (voicePreset || "").trim());
      fd.append("rvc_model", (pipelineRvc || "").trim());
      fd.append("mix_with_backing", mixWithBeat ? "true" : "false");
      fd.append("auto_lang_detect", autoLang ? "true" : "false");
      fd.append("f0_up_key", String(f0Generate));
      fd.append("sync", "true");
      const res = await fetch(`${base}/api/pipeline/full`, { method: "POST", body: fd });
      await loadResultFromResponse(res, { preferMix: mixWithBeat });
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  function togglePlay() {
    const a = audioRef.current;
    if (!a?.src) return;
    if (a.paused) void a.play();
    else a.pause();
  }

  function onScrub(e) {
    const a = audioRef.current;
    if (!a) return;
    const t = Number(e.target.value);
    a.currentTime = t;
    setCurrentTime(t);
  }

  function importLyricsFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setLyrics(String(r.result || ""));
    r.readAsText(f);
    e.target.value = "";
  }

  function exportLyricsTxt() {
    const blob = new Blob([lyrics], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "lyrics.txt";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function downloadCurrentWav() {
    if (!audioUrl || !audioUrl.startsWith("http")) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = lastPipeline ? `vocal_${lastPipeline}.wav` : "vocal_export.wav";
    a.click();
  }

  const connected = meta && !metaErr;
  const rvcOk = voices?.rvc_available;

  return (
    <div className="ve-app">
      <header className="ve-header">
        <h1>Vocal Engine</h1>
        <p>
          Lyrics with optional <code className="ve-inline-code">[Verse]</code> /{" "}
          <code className="ve-inline-code">[Chorus]</code> tags → Bark (♪ singing mode) → optional RVC → Pedalboard
          polish → beat sync + mixdown. On macOS the stack prefers <strong>MPS</strong> for Bark when available.
        </p>
        <div className="ve-status">
          <span className={`ve-pill ${connected ? "ok" : "err"}`}>
            {connected ? "API online" : "API offline"}
          </span>
          {meta ? (
            <span className="ve-pill ok">Torch: {meta.torch_device}</span>
          ) : null}
          {voices ? (
            <span className={`ve-pill ${rvcOk ? "ok" : "warn"}`}>
              RVC {rvcOk ? "ready" : "not installed — Bark + polish only"}
            </span>
          ) : null}
          <button type="button" className="ve-btn ve-btn-ghost" onClick={refreshMeta}>
            Refresh status
          </button>
        </div>
        {metaErr ? <div className="ve-error">{metaErr}</div> : null}
      </header>

      <div className="ve-tabs" role="tablist">
        {[
          ["vocalbox", "Vocal Box"],
          ["lyrics", "From lyrics"],
          ["studio", "Beat + sync"],
          ["convert", "Upload → RVC"],
          ["polish", "Upload → Polish"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={`ve-tab ${tab === id ? "active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "vocalbox" ? (
        <div className="ve-card" style={{ marginBottom: "1rem" }}>
          <VocalBox />
        </div>
      ) : null}

      {tab === "lyrics" && (
        <form className="ve-card" onSubmit={onGenerate}>
          <h2>Compose</h2>
          <div className="ve-field">
            <span className="ve-label">Lyrics (structure tags supported)</span>
            <textarea
              className="ve-textarea"
              value={lyrics}
              onChange={(e) => setLyrics(e.target.value)}
              placeholder={"[Verse]\nYour lines…\n\n[Chorus]\nHook here…"}
              required
            />
            <div className="ve-btn-row">
              <button
                type="button"
                className="ve-btn ve-btn-secondary"
                onClick={() => lyricsFileRef.current?.click()}
              >
                Import .txt
              </button>
              <button type="button" className="ve-btn ve-btn-secondary" onClick={exportLyricsTxt}>
                Export .txt
              </button>
              <input
                ref={lyricsFileRef}
                type="file"
                accept=".txt,text/plain"
                className="ve-hidden-audio"
                onChange={importLyricsFile}
              />
            </div>
          </div>
          <div className="ve-row">
            <div className="ve-field">
              <span className="ve-label">Language</span>
              <select className="ve-select" value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="en">English</option>
                <option value="nl">Dutch (Nederlands)</option>
                <option value="af">Afrikaans (Dutch phonetics)</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.35rem" }}>
                <input type="checkbox" checked={autoLang} onChange={(e) => setAutoLang(e.target.checked)} /> Auto-detect
                language (langdetect)
              </label>
            </div>
            <div className="ve-field">
              <span className="ve-label">Bark voice</span>
              <select className="ve-select" value={voicePreset} onChange={(e) => setVoicePreset(e.target.value)}>
                <option value="">Default for selected language</option>
                {(voices?.bark_presets || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ve-field">
              <span className="ve-label">RVC model (optional)</span>
              <select
                className="ve-select"
                value={rvcModel}
                onChange={(e) => setRvcModel(e.target.value)}
                disabled={!rvcOk}
              >
                <option value="">None — Bark + studio polish</option>
                {(voices?.rvc_models || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="ve-field">
            <span className="ve-label">Pitch shift (semitones): {f0Generate}</span>
            <input
              type="range"
              className="ve-range"
              min={-12}
              max={12}
              step={1}
              value={f0Generate}
              onChange={(e) => setF0Generate(Number(e.target.value))}
            />
          </div>
          <button type="submit" className="ve-btn ve-btn-primary" disabled={busy}>
            {busy ? "Rendering…" : "Generate vocal"}
          </button>
        </form>
      )}

      {tab === "studio" && (
        <form className="ve-card" onSubmit={onFullStudio}>
          <h2>Beat + lyric sync</h2>
          <p style={{ margin: "0 0 1rem", color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.5 }}>
            Analyzes your backing <code className="ve-inline-code">.wav</code> with Librosa (BPM + beat times), aligns{" "}
            <code className="ve-inline-code">[Verse]</code>/<code className="ve-inline-code">[Chorus]</code> lines to
            the grid, generates Bark per segment (♪), runs Pedalboard + optional RVC, then merges vocal + beat.
          </p>
          <div className="ve-field">
            <span className="ve-label">Backing beat (.wav)</span>
            <input ref={beatStudioRef} type="file" accept=".wav,audio/wav" className="ve-file" required />
          </div>
          <div className="ve-row">
            <div className="ve-field">
              <span className="ve-label">Language</span>
              <select className="ve-select" value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="en">English</option>
                <option value="nl">Dutch</option>
                <option value="af">Afrikaans</option>
              </select>
            </div>
            <div className="ve-field">
              <span className="ve-label">Bark voice</span>
              <select className="ve-select" value={voicePreset} onChange={(e) => setVoicePreset(e.target.value)}>
                <option value="">Default for language</option>
                {(voices?.bark_presets || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="ve-field">
            <span className="ve-label">RVC model (optional — requires server RVC)</span>
            <select
              className="ve-select"
              value={pipelineRvc}
              onChange={(e) => setPipelineRvc(e.target.value)}
              disabled={!rvcOk}
            >
              <option value="">Polish only (no RVC)</option>
              {(voices?.rvc_models || []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ve-field">
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input type="checkbox" checked={mixWithBeat} onChange={(e) => setMixWithBeat(e.target.checked)} />
              Final mixdown (vocal + backing)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.35rem" }}>
              <input type="checkbox" checked={autoLang} onChange={(e) => setAutoLang(e.target.checked)} />
              Auto language detect on lyrics
            </label>
          </div>
          <div className="ve-field">
            <span className="ve-label">Pitch (semitones): {f0Generate}</span>
            <input
              type="range"
              className="ve-range"
              min={-12}
              max={12}
              step={1}
              value={f0Generate}
              onChange={(e) => setF0Generate(Number(e.target.value))}
            />
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
            Uses the lyrics from the <strong>From lyrics</strong> box above. Runs synchronously (shows activity in the
            progress strip). Async jobs: POST <code className="ve-inline-code">sync=false</code> via API +{" "}
            <code className="ve-inline-code">/api/jobs/{"{id}"}</code>.
          </p>
          <button type="submit" className="ve-btn ve-btn-primary" disabled={busy}>
            {busy ? "Running pipeline…" : "Run full studio pipeline"}
          </button>
        </form>
      )}

      {tab === "convert" && (
        <form className="ve-card" onSubmit={onConvert}>
          <h2>Your stem → RVC</h2>
          <p style={{ margin: "0 0 1rem", color: "var(--muted)", fontSize: "0.85rem" }}>
            Upload a dry vocal <code style={{ color: "var(--accent2)" }}>.wav</code>. The server runs RVC then the same
            polish chain as the lyric pipeline.
          </p>
          <div className="ve-field">
            <span className="ve-label">Audio file</span>
            <input
              ref={uploadRef}
              type="file"
              accept=".wav,audio/wav"
              className="ve-file"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            />
          </div>
          <div className="ve-row">
            <div className="ve-field">
              <span className="ve-label">RVC model</span>
              <select
                className="ve-select"
                value={rvcConvert}
                onChange={(e) => setRvcConvert(e.target.value)}
                disabled={!rvcOk}
              >
                {(voices?.rvc_models || []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="ve-field">
              <span className="ve-label">Pitch (semitones): {f0Convert}</span>
              <input
                type="range"
                className="ve-range"
                min={-12}
                max={12}
                step={1}
                value={f0Convert}
                onChange={(e) => setF0Convert(Number(e.target.value))}
              />
            </div>
          </div>
          {!voices?.rvc_models?.length ? (
            <p style={{ color: "var(--warn, #fcd34d)", fontSize: "0.82rem", marginTop: "0.5rem" }}>
              Add <code>.pth</code> files under <code>backend/models/rvc_voices/</code> (or the Docker volume mount) to
              list models here.
            </p>
          ) : null}
          <button
            type="submit"
            className="ve-btn ve-btn-primary"
            disabled={busy || !rvcOk || !voices?.rvc_models?.length || !uploadFile}
          >
            {busy ? "Working…" : "Convert upload"}
          </button>
        </form>
      )}

      {tab === "polish" && (
        <form className="ve-card" onSubmit={onPolish}>
          <h2>Polish only</h2>
          <p style={{ margin: "0 0 1rem", color: "var(--muted)", fontSize: "0.85rem" }}>
            Noise gate, EQ tilt, compression, and reverb — no RVC. Works without RVC installed.
          </p>
          <div className="ve-field">
            <span className="ve-label">WAV to polish</span>
            <input ref={polishRef} type="file" accept=".wav,audio/wav" className="ve-file" />
          </div>
          <button type="submit" className="ve-btn ve-btn-primary" disabled={busy}>
            {busy ? "Polishing…" : "Apply polish"}
          </button>
        </form>
      )}

      {error ? <div className="ve-error">{error}</div> : null}

      {pipelineInfo?.bpm != null ? (
        <div className="ve-card ve-pipeline-meta">
          <strong>Last sync</strong>: {pipelineInfo.bpm} BPM — {pipelineInfo.beat_count ?? "—"} beats — meter{" "}
          {pipelineInfo.meter?.numerator}/{pipelineInfo.meter?.denominator}
        </div>
      ) : null}

      {busy ? (
        <div className="ve-progress-card" aria-live="polite">
          <div className="ve-progress-bar" />
          <p className="ve-progress-caption">Detecting beat → Syncing lines → Bark (♪) → Voice swap → Polish → Mix…</p>
        </div>
      ) : null}

      {audioUrl ? (
        <section className="ve-card ve-wave-section">
          <h2>Preview</h2>
          <div ref={waveMountRef} className="ve-wave-mount" />
        </section>
      ) : null}

      <audio ref={audioRef} className="ve-hidden-audio" src={audioUrl || undefined} preload="metadata" />

      <footer className="ve-dock" aria-label="Transport">
        <div className="ve-dock-inner">
          <button
            type="button"
            className="ve-dock-play"
            onClick={togglePlay}
            disabled={!audioUrl}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? "❚❚" : "▶"}
          </button>
          <div className="ve-dock-main">
            <div className="ve-dock-title">
              {audioUrl
                ? `Ready — ${lastPipeline || "output"}`
                : "No audio yet — generate or upload to hear your track."}
            </div>
            <input
              type="range"
              className="ve-dock-scrub"
              min={0}
              max={Number.isFinite(duration) && duration > 0 ? duration : 1}
              step={0.01}
              value={Number.isFinite(currentTime) ? currentTime : 0}
              onChange={onScrub}
              disabled={!audioUrl}
            />
            <div className="ve-dock-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          <div className="ve-dock-actions">
            <button type="button" className="ve-btn ve-btn-secondary" onClick={downloadCurrentWav} disabled={!audioUrl}>
              Download WAV
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

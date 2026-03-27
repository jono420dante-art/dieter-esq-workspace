import { useEffect, useMemo, useState } from "react";

const apiBase = () => (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

/** Ordered backend stages for rough progress through the chip row */
const STAGE_ORDER = [
  "starting",
  "analyzing_beat",
  "syncing_lyrics",
  "bark",
  "generating_melody",
  "rvc",
  "applying_human_voice",
  "polish",
  "polishing_mix",
  "mixing",
  "finalize",
  "done",
];

const CHIPS = [
  { id: "beat", label: "Beat detection", stages: ["analyzing_beat", "syncing_lyrics"] },
  { id: "bark", label: "Bark", stages: ["bark", "generating_melody"] },
  { id: "rvc", label: "RVC", stages: ["rvc", "applying_human_voice"] },
  { id: "pedalboard", label: "Pedalboard", stages: ["polish", "polishing_mix"] },
  { id: "mixer", label: "Mixer", stages: ["mixing"] },
];

function chipStatus(chip, currentStage, pipelineDone) {
  if (pipelineDone) return "done";
  const c = currentStage || "";
  if (chip.stages.includes(c)) return "active";
  const idxs = chip.stages.map((s) => STAGE_ORDER.indexOf(s)).filter((i) => i >= 0);
  if (!idxs.length) return "idle";
  const last = Math.max(...idxs);
  const first = Math.min(...idxs);
  const o = STAGE_ORDER.indexOf(c);
  if (o < 0) return c === "finalize" ? "active" : "idle";
  if (o > last) return "done";
  if (o < first) return "idle";
  return "next";
}

/**
 * Simple VocalBox → FastAPI ``/api/generate-singing`` + ``/media/…`` for ``<audio>``.
 * Async mode polls ``/api/jobs/{id}`` so the UI can show Beat → Bark → RVC → Pedalboard → Mixer.
 */
export default function VocalBox() {
  const base = useMemo(() => apiBase(), []);
  const [lyrics, setLyrics] = useState("");
  const [language, setLanguage] = useState("en");
  const [modelName, setModelName] = useState("afrikaans_singer_v1");
  const [status, setStatus] = useState("Idle");
  const [audioUrl, setAudioUrl] = useState(null);
  const [useAsync, setUseAsync] = useState(true);
  const [jobStage, setJobStage] = useState("");
  const [jobProgress, setJobProgress] = useState(0);
  const [pipelineDone, setPipelineDone] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    return () => {
      /* no persistent interval; each run clears in handleGenerate */
    };
  }, []);

  const handleGenerate = async () => {
    if (!lyrics.trim()) return;
    setAudioUrl(null);
    setPipelineDone(false);
    setJobStage("");
    setJobProgress(0);
    setProcessing(true);
    setStatus("Submitting…");

    let intervalId = 0;

    try {
      if (useAsync) {
        const response = await fetch(`${base}/api/generate-singing`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lyrics: lyrics.trim(),
            language,
            model_name: modelName.trim() || null,
            async_mode: true,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const msg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data);
          throw new Error(msg);
        }
        if (!data.job_id) throw new Error("No job_id");

        await new Promise((resolve, reject) => {
          intervalId = window.setInterval(async () => {
            try {
              const r = await fetch(`${base}/api/jobs/${data.job_id}`);
              const j = await r.json();
              if (!r.ok) return;
              setJobStage(j.stage || "");
              setJobProgress(typeof j.progress === "number" ? j.progress : 0);
              setStatus(j.message || j.stage || "Processing…");
              if (j.stage === "done" && j.result?.status === "success" && j.result?.url) {
                window.clearInterval(intervalId);
                setAudioUrl(`${base}${j.result.url}`);
                setStatus("Success! Real singing layer ready.");
                setPipelineDone(true);
                resolve();
              }
              if (j.stage === "error") {
                window.clearInterval(intervalId);
                reject(new Error(j.error || j.message || "Pipeline failed"));
              }
            } catch (e) {
              window.clearInterval(intervalId);
              reject(e);
            }
          }, 400);
        });
        return;
      }

      const response = await fetch(`${base}/api/generate-singing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics: lyrics.trim(),
          language,
          model_name: modelName.trim() || null,
          async_mode: false,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || data);
        throw new Error(msg);
      }
      if (data.status === "success" && data.url) {
        setAudioUrl(`${base}${data.url}`);
        setStatus("Success! Real singing layer ready.");
        setPipelineDone(true);
        setJobStage("done");
      } else {
        throw new Error(data.detail || "Unexpected response");
      }
    } catch (error) {
      setStatus(`Error in build pipeline: ${error.message || String(error)}`);
      console.error(error);
      if (intervalId) window.clearInterval(intervalId);
    } finally {
      setProcessing(false);
    }
  };

  const langs = [
    { code: "en", label: "English" },
    { code: "nl", label: "Dutch" },
    { code: "af", label: "Afrikaans" },
  ];

  return (
    <div className="vocal-box">
      <h2 className="vocal-box-title">
        <span className="vocal-box-emoji" aria-hidden>
          🎙️
        </span>{" "}
        AI Vocal Engine <span className="vocal-box-badge">v1.0</span>
      </h2>
      <p className="vocal-box-sub">
        FastAPI <code className="ve-inline-code">/api/generate-singing</code> · static WAVs under{" "}
        <code className="ve-inline-code">/media/</code>
      </p>

      <div className="vocal-box-lang">
        {langs.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            className={`vocal-box-lang-btn ${language === code ? "active" : ""}`}
            onClick={() => setLanguage(code)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="vocal-box-model">
        <span>RVC model (basename of .pth in backend/models/rvc_voices/)</span>
        <input
          type="text"
          value={modelName}
          onChange={(e) => setModelName(e.target.value)}
          placeholder="leave empty for Bark + Pedalboard only"
          className="vocal-box-input"
        />
      </label>

      <label className="vocal-box-check">
        <input type="checkbox" checked={useAsync} onChange={(e) => setUseAsync(e.target.checked)} />
        Processing: live stages (poll job — Beat → Bark → RVC → Pedalboard → Mixer)
      </label>

      <textarea
        className="vocal-box-textarea"
        placeholder="Lyrics… [Verse] / [Chorus] optional. Server adds ♪ for singing."
        value={lyrics}
        onChange={(e) => setLyrics(e.target.value)}
      />

      <div className="vocal-box-pipeline" aria-label="Pipeline stages">
        {CHIPS.map((g) => (
          <div key={g.id} className={`vocal-box-chip vocal-box-chip--${chipStatus(g, jobStage, pipelineDone)}`}>
            <span className="vocal-box-chip-dot" />
            {g.label}
          </div>
        ))}
        {useAsync && processing && jobProgress > 0 && jobProgress < 1 ? (
          <div className="vocal-box-pct">{Math.round(jobProgress * 100)}%</div>
        ) : null}
      </div>

      <button
        type="button"
        className="vocal-box-generate"
        onClick={handleGenerate}
        disabled={!lyrics.trim() || processing}
      >
        {processing ? "Processing models…" : "GENERATE REAL SINGING"}
      </button>

      <p className="vocal-box-status">
        <em>Status:</em> {status}
      </p>

      {audioUrl ? (
        <div className="vocal-box-player">
          <p className="vocal-box-player-label">Final produced layer</p>
          <audio controls src={audioUrl} className="vocal-box-audio" />
        </div>
      ) : null}
    </div>
  );
}

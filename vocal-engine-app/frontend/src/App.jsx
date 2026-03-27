import { useMemo, useState } from "react";

const apiBase = () =>
  (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

export default function App() {
  const [lyrics, setLyrics] = useState("We are building voices that feel alive.");
  const [voicePreset, setVoicePreset] = useState("v2/en_speaker_6");
  const [rvcModel, setRvcModel] = useState("my_singer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  const base = useMemo(() => apiBase(), []);

  async function onGenerate(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl("");
    }
    try {
      const res = await fetch(`${base}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lyrics: lyrics.trim(),
          voice_preset: voicePreset.trim(),
          rvc_model: rvcModel.trim(),
          f0_up_key: 0,
          use_music_notes: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const d = data.detail;
        const msg =
          typeof d === "string" ? d : Array.isArray(d) ? JSON.stringify(d) : res.statusText || "Generate failed";
        throw new Error(msg);
      }
      const url = `${base}${data.download_url}`;
      setAudioUrl(url);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={shell}>
      <header style={hero}>
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>The Box</h1>
        <p style={{ margin: "0.35rem 0 0", opacity: 0.85, maxWidth: 520 }}>
          Lyrics → Bark → RVC + studio polish. Place{" "}
          <code style={code}>models/rvc_voices/{`{name}`}.pth</code> on the server.
        </p>
      </header>

      <form onSubmit={onGenerate} style={form}>
        <label style={lbl}>
          Lyrics
          <textarea
            rows={5}
            value={lyrics}
            onChange={(e) => setLyrics(e.target.value)}
            style={ta}
            required
          />
        </label>
        <div style={row}>
          <label style={lbl}>
            Bark voice preset
            <input
              value={voicePreset}
              onChange={(e) => setVoicePreset(e.target.value)}
              style={inp}
            />
          </label>
          <label style={lbl}>
            RVC model name
            <input
              value={rvcModel}
              onChange={(e) => setRvcModel(e.target.value)}
              style={inp}
              placeholder="basename of .pth"
              required
            />
          </label>
        </div>
        <button type="submit" disabled={busy} style={btn}>
          {busy ? "Generating…" : "Generate"}
        </button>
      </form>

      {error ? <p style={err}>{error}</p> : null}

      {audioUrl ? (
        <section style={{ marginTop: "1.5rem" }}>
          <p style={{ margin: "0 0 0.5rem", fontSize: "0.9rem" }}>Result</p>
          <audio controls src={audioUrl} style={{ width: "100%", maxWidth: 480 }} />
          <p style={{ marginTop: "0.75rem" }}>
            <a href={audioUrl} download style={{ color: "#93c5fd" }}>
              Download WAV
            </a>
          </p>
        </section>
      ) : null}
    </div>
  );
}

const shell = {
  minHeight: "100vh",
  margin: 0,
  padding: "2rem 1.5rem",
  background: "linear-gradient(165deg, #0f172a 0%, #1e1b4b 55%, #312e81 100%)",
  color: "#e2e8f0",
  fontFamily: 'system-ui, "Segoe UI", sans-serif',
  boxSizing: "border-box",
};

const hero = { marginBottom: "1.75rem" };
const form = { display: "flex", flexDirection: "column", gap: "1rem", maxWidth: 640 };
const lbl = { display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.85rem" };
const ta = {
  padding: "0.75rem",
  borderRadius: 8,
  border: "1px solid #475569",
  background: "#0f172a",
  color: "#f8fafc",
  resize: "vertical",
};
const inp = { padding: "0.55rem 0.65rem", borderRadius: 8, border: "1px solid #475569", background: "#0f172a", color: "#f8fafc" };
const row = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" };
const btn = {
  alignSelf: "flex-start",
  padding: "0.65rem 1.25rem",
  borderRadius: 8,
  border: "none",
  background: "#6366f1",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};
const err = { color: "#fca5a5", maxWidth: 640 };
const code = { background: "#1e293b", padding: "0.1rem 0.35rem", borderRadius: 4 };

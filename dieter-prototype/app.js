const ROUTES = /** @type {const} */ ({
  studio: {
    label: "Studio",
    bg: "url('./assets/bg-studio-neon.png')",
    title: "Write. Generate. Mix. Export.",
    subtitle: "A futuristic home studio with structure planning, expressive voices, and a clean DAW.",
    render: renderStudio,
  },
  video: {
    label: "Video Sync",
    bg: "url('./assets/bg-vocals-neon.png')",
    title: "Generate beat-synced video.",
    subtitle: "Upload a song, set BPM, and export a synced WebM video.",
    render: renderVideo,
  },
  workshop: {
    label: "Workshop",
    bg: "url('./assets/bg-vocals-neon.png')",
    title: "Digital Workshop: trim + fades.",
    subtitle: "Upload audio, shorten it, add fades, and export WAV for portals.",
    render: renderWorkshop,
  },
  library: {
    label: "Library",
    bg: "url('./assets/bg-space.png')",
    title: "Your infinite catalog.",
    subtitle: "Search drafts, stems, lyrics, and versions. Nothing gets lost.",
    render: renderLibrary,
  },
  publish: {
    label: "Publish",
    bg: "url('./assets/bg-space.png')",
    title: "Portals to the world.",
    subtitle: "Export bundles and jump straight to YouTube / Spotify / SoundCloud dashboards.",
    render: renderPublish,
  },
  director: {
    label: "AI Director",
    bg: "url('./assets/bg-space.png')",
    title: "Your AI Agent: plan, polish, promote.",
    subtitle: "Guidance, checklists, and automation hooks (backend-ready).",
    render: renderDirector,
  },
});

const $app = mustGetEl("app");
const $mount = mustGetEl("routeMount");
const $routePill = mustGetEl("routePill");
const $routeTitle = mustGetEl("routeTitle");
const $routeSubtitle = mustGetEl("routeSubtitle");
const $status = mustGetEl("status");
const $btnTheme = mustGetEl("btnTheme");
const $btnUniverse = mustGetEl("btnUniverse");
const $btnNew = mustGetEl("btnNew");
const $btnGenerate = mustGetEl("btnGenerate");
const $prompt = /** @type {HTMLTextAreaElement} */ (mustGetEl("prompt"));
const $btnExpand = /** @type {HTMLButtonElement} */ (mustGetEl("btnExpand"));
const $editorModal = mustGetEl("editorModal");
const $btnCloseEditor = mustGetEl("btnCloseEditor");
const $promptBig = /** @type {HTMLTextAreaElement} */ (mustGetEl("promptBig"));
const $btnCopyToSmall = mustGetEl("btnCopyToSmall");
const $btnGenerateBig = mustGetEl("btnGenerateBig");
const $lyricsModal = mustGetEl("lyricsModal");
const $btnCloseLyrics = mustGetEl("btnCloseLyrics");
const $lyricsBig = /** @type {HTMLTextAreaElement} */ (mustGetEl("lyricsBig"));
const $btnCopyLyricsToStudio = mustGetEl("btnCopyLyricsToStudio");
const $btnGenerateLyrics = mustGetEl("btnGenerateLyrics");
const $settingsModal = mustGetEl("settingsModal");
const $btnCloseSettings = mustGetEl("btnCloseSettings");
const $btnSaveSettings = mustGetEl("btnSaveSettings");
const $btnResetSettings = mustGetEl("btnResetSettings");
const $settingsTitle = mustGetEl("settingsTitle");
const $settingsStyle = mustGetEl("settingsStyle");
const $settingsMood = mustGetEl("settingsMood");
const $settingsLang = mustGetEl("settingsLang");
const $settingsVocal = mustGetEl("settingsVocal");
const $settingsBpm = /** @type {HTMLInputElement} */ (mustGetEl("settingsBpm"));
const $builderMount = mustGetEl("builderMount");
const $settingsVocalMode = mustGetEl("settingsVocalMode");
const $settingsLiveVoice = /** @type {HTMLSelectElement} */ (mustGetEl("settingsLiveVoice"));
const $universeCanvas = /** @type {HTMLCanvasElement} */ (mustGetEl("universeCanvas"));

/** simple in-memory state (prototype) */
const state = {
  projectName: "Untitled",
  lastRoute: "studio",
  lastGeneratedAt: null,
  modelLine: "V7.5",
  tier: "pro",
  streaming: "hls",
  stems: true,
  style: "Cinematic",
  language: "en",
  mood: "Neon",
  vocalPreset: "Radio",
  bpm: 128,
  lyrics: "",
  vocalMode: "singing_stem", // or "live_voice"
  liveVoiceURI: "",
  universe: true,
};

const VOICE_PRESETS = [
  "Radio",
  "Pop",
  "Rock",
  "Trap",
  "Choir",
  "Alien",
  "Elf",
  "Robot",
  "Demon",
  "Angel",
  "Giant",
  "Childlike",
  "Male Warm",
  "Male Deep",
  "Female Bright",
  "Female Warm",
  "Whisper",
  "Opera",
  "Afro Soul",
  "K-Pop",
  "Reggae Toast",
  "Dancehall",
  "R&B Velvet",
  "EDM Topline",
];

/** WebAudio stem mixer (client-side) */
const mixer = {
  /** @type {AudioContext | null} */
  ctx: null,
  /** @type {GainNode | null} */
  master: null,
  /** @type {AnalyserNode | null} */
  analyser: null,
  /** @type {Uint8Array | null} */
  analyserBins: null,
  /** @type {Record<string, { gain: GainNode, muted: boolean, solo: boolean, db: number }>} */
  buses: {},
  /** @type {Record<string, { buffer: AudioBuffer, gain: GainNode, muted: boolean, solo: boolean, db: number }>} */
  tracks: {},
  /** @type {Record<string, string>} */
  trackBus: {},
  /** @type {Record<string, AudioBufferSourceNode>} */
  sources: {},
  playing: false,
  /** @type {string[]} */
  order: [],
  /** @type {number} */
  masterDb: 0,
};

// --- Session storage (Library) ---
const STORAGE_KEY = "dieter_sessions_v1";

init();

function init() {
  window.addEventListener("hashchange", onRouteChange);
  $btnTheme.addEventListener("click", toggleGlow);
  $btnUniverse.addEventListener("click", toggleUniverse);
  $btnNew.addEventListener("click", newProject);
  $btnGenerate.addEventListener("click", generateStub);
  $btnExpand.addEventListener("click", openWriter);
  $btnCloseEditor.addEventListener("click", closeWriter);
  $btnCopyToSmall.addEventListener("click", copyToStudio);
  $btnGenerateBig.addEventListener("click", () => {
    copyToStudio();
    closeWriter();
    generateStub();
  });
  $btnCloseLyrics.addEventListener("click", closeLyricsWriter);
  $btnCopyLyricsToStudio.addEventListener("click", copyLyricsToStudio);
  $btnGenerateLyrics.addEventListener("click", () => {
    copyLyricsToStudio();
    closeLyricsWriter();
    generateStub();
  });
  $btnCloseSettings.addEventListener("click", closeSettings);
  $btnSaveSettings.addEventListener("click", saveSettings);
  $btnResetSettings.addEventListener("click", resetSettings);

  // wire the 4 header quick buttons
  /** @type {NodeListOf<HTMLButtonElement>} */
  const quick = document.querySelectorAll("button[data-chip]");
  quick.forEach((b) => b.addEventListener("click", () => openSettings(b.dataset.chip || "")));

  // build settings modal chips once
  buildSettingsChips();
  syncSettingsUI();
  syncQuickButtons();
  initLiveVoices();
  renderSongBuilder();
  universeInit();
  applyUniverseUI();

  // keyboard shortcut: Ctrl/Cmd + Enter to "Generate"
  $prompt.addEventListener("keydown", (e) => {
    const isCmdEnter = (e.ctrlKey || e.metaKey) && e.key === "Enter";
    if (!isCmdEnter) return;
    e.preventDefault();
    generateStub();
  });

  $promptBig.addEventListener("keydown", (e) => {
    const isCmdEnter = (e.ctrlKey || e.metaKey) && e.key === "Enter";
    if (!isCmdEnter) return;
    e.preventDefault();
    copyToStudio();
    closeWriter();
    generateStub();
  });

  $lyricsBig.addEventListener("keydown", (e) => {
    const isCmdEnter = (e.ctrlKey || e.metaKey) && e.key === "Enter";
    if (!isCmdEnter) return;
    e.preventDefault();
    copyLyricsToStudio();
    closeLyricsWriter();
    generateStub();
  });

  // default route
  if (!location.hash || location.hash === "#") {
    location.hash = "#/studio";
    return;
  }
  onRouteChange();
}

function renderSongBuilder() {
  if (!$builderMount) return;
  $builderMount.innerHTML = "";

  const wrap = el("div", { className: "builderCard" });
  const top = el("div", { className: "builderTop" });
  top.appendChild(el("div", { className: "builderTitle", textContent: "Song Builder (options while you create)" }));
  const actions = el("div", { className: "builderActions" });
  actions.appendChild(
    el("button", { className: "chip", type: "button", textContent: "Open settings", onclick: () => openSettings("") })
  );
  actions.appendChild(
    el("button", {
      className: "chip",
      type: "button",
      textContent: "Audition style",
      onclick: () => auditionStyle(state.style, state.bpm),
    })
  );
  actions.appendChild(
    el("button", {
      className: "chip",
      type: "button",
      textContent: "Audition vocal",
      onclick: () => auditionVocal(state.language, state.vocalPreset),
    })
  );
  top.appendChild(actions);
  wrap.appendChild(top);

  const grid = el("div", { className: "builderGrid" });

  const left = el("div", { className: "field" });
  left.appendChild(el("div", { className: "label", textContent: "Style / Mood / Language / Vocal" }));
  left.appendChild(
    pickerRow("Style", "style", ["Cinematic", "Pop", "Hip‑hop", "Electronic", "Rock", "Lo‑Fi"], state.style)
  );
  left.appendChild(pickerRow("Mood", "mood", ["Neon", "Dark", "Hopeful", "Aggressive", "Chill", "Epic"], state.mood));
  left.appendChild(pickerRow("Language", "language", ["en", "af", "de", "es", "fr", "ja", "ko"], state.language));
  left.appendChild(pickerRow("Vocals", "vocal", VOICE_PRESETS, state.vocalPreset));

  const right = el("div", { className: "field" });
  right.appendChild(el("div", { className: "label", textContent: "Timing + Output" }));
  const row = el("div", { className: "subRow" });

  const bpmInput = el("input", { className: "input", type: "number", value: String(state.bpm || 128) });
  bpmInput.oninput = () => {
    state.bpm = clampNum(Number(bpmInput.value || 128), 40, 240);
    syncQuickButtons();
    syncSettingsUI();
  };
  row.appendChild(field("BPM", bpmInput));

  const dur = /** @type {HTMLInputElement | null} */ (document.querySelector("[data-duration-sec]"));
  const durInput = el("input", { className: "input", type: "number", value: String(dur?.value || 30) });
  durInput.oninput = () => {
    const v = clampNum(Number(durInput.value || 30), 5, 240);
    if (dur) dur.value = String(v);
  };
  row.appendChild(field("Duration", durInput));
  right.appendChild(row);

  const modeRow = el("div", { className: "subRow" });
  const modeSel = el("select", { className: "input" });
  ["singing_stem", "live_voice"].forEach((v) => modeSel.appendChild(el("option", { value: v, textContent: v })));
  modeSel.value = state.vocalMode;
  modeSel.onchange = () => {
    state.vocalMode = modeSel.value;
    setModalActive("vocalMode", state.vocalMode);
  };
  modeRow.appendChild(field("Vocal mode", modeSel));

  const stemsChk = el("input", { type: "checkbox" });
  stemsChk.checked = !!state.stems;
  stemsChk.onchange = () => (state.stems = stemsChk.checked);
  modeRow.appendChild(
    field(
      "Stems",
      el("div", {
        className: "check",
        children: [stemsChk, el("div", { className: "card__muted", textContent: "Export stems" })],
      })
    )
  );
  right.appendChild(modeRow);

  grid.appendChild(left);
  grid.appendChild(right);
  wrap.appendChild(grid);

  $builderMount.appendChild(wrap);
}

function openWriter() {
  $promptBig.value = $prompt.value || "";
  $editorModal.classList.add("isOpen");
  $editorModal.setAttribute("aria-hidden", "false");
  setTimeout(() => $promptBig.focus(), 0);
}

function closeWriter() {
  $editorModal.classList.remove("isOpen");
  $editorModal.setAttribute("aria-hidden", "true");
}

function copyToStudio() {
  $prompt.value = $promptBig.value || "";
}

function openLyricsWriter() {
  const small = /** @type {HTMLTextAreaElement | null} */ (document.querySelector("[data-lyrics-input]"));
  $lyricsBig.value = small ? small.value : state.lyrics || "";
  $lyricsModal.classList.add("isOpen");
  $lyricsModal.setAttribute("aria-hidden", "false");
  setTimeout(() => $lyricsBig.focus(), 0);
}

function closeLyricsWriter() {
  $lyricsModal.classList.remove("isOpen");
  $lyricsModal.setAttribute("aria-hidden", "true");
}

function copyLyricsToStudio() {
  const small = /** @type {HTMLTextAreaElement | null} */ (document.querySelector("[data-lyrics-input]"));
  if (small) small.value = $lyricsBig.value || "";
  state.lyrics = $lyricsBig.value || "";
}

function onRouteChange() {
  mixerStop();
  const routeKey = parseRoute(location.hash);
  state.lastRoute = routeKey;
  const route = ROUTES[routeKey];

  $app.dataset.route = routeKey;
  $app.style.setProperty("--page-bg", route.bg);
  $routePill.textContent = route.label;
  $routeTitle.textContent = route.title;
  $routeSubtitle.textContent = route.subtitle;
  setActiveNav(routeKey);

  $mount.innerHTML = "";
  $mount.appendChild(route.render());
  setStatus(`${route.label} ready.`);
}

function parseRoute(hash) {
  const raw = (hash || "").replace(/^#\/?/, "");
  const key = raw.split("?")[0].trim().toLowerCase();
  if (key in ROUTES) return /** @type {keyof typeof ROUTES} */ (key);
  return "studio";
}

function setActiveNav(routeKey) {
  /** @type {NodeListOf<HTMLAnchorElement>} */
  const links = document.querySelectorAll("[data-nav]");
  links.forEach((a) => {
    a.classList.toggle("isActive", a.dataset.nav === routeKey);
  });
}

function toggleGlow() {
  document.body.classList.toggle("glow");
}

function toggleUniverse() {
  state.universe = !state.universe;
  applyUniverseUI();
}

function applyUniverseUI() {
  $app.classList.toggle("isUniverse", !!state.universe);
  if (!state.universe) {
    // clear to black so it doesn't "ghost" on stop
    const ctx = $universeCanvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, $universeCanvas.width, $universeCanvas.height);
  }
}

function newProject() {
  mixerStop();
  mixerReset();
  const name = `Project ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  state.projectName = name;
  $prompt.value = "";
  setStatus(`New project created: ${name}`);
}

function generateStub() {
  const text = ($prompt.value || "").trim();
  if (!text) {
    setStatus("Type something in the thought bubble first.");
    $prompt.focus();
    return;
  }

  const now = new Date();
  state.lastGeneratedAt = now.toISOString();
  const seed = hash(text);
  const bpmFromText = parseBpm(text);
  const bpm = clampNum(bpmFromText || state.bpm || 128, 40, 240);
  const fallbackMood = pick(["Cinematic", "Dark", "Hopeful", "Neon", "Lo‑Fi", "Club"], seed);
  const fallbackVoice = pick(VOICE_PRESETS, seed * 13);

  // read current studio selections (if present)
  const modelSel = /** @type {HTMLSelectElement | null} */ (document.querySelector("[data-model-line]"));
  const tierSel = /** @type {HTMLSelectElement | null} */ (document.querySelector("[data-tier]"));
  const streamSel = /** @type {HTMLSelectElement | null} */ (document.querySelector("[data-streaming]"));
  const stemsChk = /** @type {HTMLInputElement | null} */ (document.querySelector("[data-stems]"));
  const inputSel = /** @type {HTMLSelectElement | null} */ (document.querySelector("[data-input-type]"));

  if (modelSel) state.modelLine = modelSel.value;
  if (tierSel) state.tier = tierSel.value;
  if (streamSel) state.streaming = streamSel.value;
  if (stemsChk) state.stems = stemsChk.checked;
  const inputType = inputSel?.value || "text";

  // read chip pickers (Studio section)
  state.style = getActiveChipValue("style") || state.style;
  state.language = getActiveChipValue("language") || state.language;
  state.mood = getActiveChipValue("mood") || state.mood || fallbackMood;
  state.vocalPreset = getActiveChipValue("vocal") || state.vocalPreset || fallbackVoice;
  state.bpm = bpm;
  state.lyrics =
    (/** @type {HTMLTextAreaElement | null} */ (document.querySelector("[data-lyrics-input]"))?.value || state.lyrics || "").trim();

  syncQuickButtons();

  setStatus(
    `Queued: ${state.modelLine} • Tier: ${state.tier.toUpperCase()} • ${state.style} • ${state.mood} • ${bpm} BPM • Vocal: ${state.vocalPreset}`
  );

  // Real build: call backend plan + generate, then poll job.
  if (state.lastRoute !== "studio") location.hash = "#/studio";
  const banner = document.querySelector("[data-studio-banner]");
  if (banner)
    banner.textContent = `Queued: ${state.style} • ${state.mood} • ${bpm} BPM • ${state.modelLine} • ${state.language} • ${state.vocalPreset}`;

  runBackendGenerate({
    prompt: text,
    lyrics: state.lyrics,
    bpm,
    mood: state.mood || fallbackMood,
    style: state.style,
    language: state.language,
    vocalPreset: state.vocalPreset,
  }).catch((e) => {
    setStatus(`Backend error: ${e?.message || String(e)}`);
  });

  const tags = document.querySelector("[data-pipeline-tags]");
  if (tags) {
    tags.innerHTML = "";
    const steps = [
      `Input: ${inputType}`,
      "Planner: MusiCoT",
      `Core: ${state.modelLine}`,
      "Vocals: multi-lang (backend)",
      "Mix: stems + mastering",
      "Platform: REST + agents",
    ];
    steps.forEach((t) => tags.appendChild(el("span", { className: "tag", textContent: t })));
  }
}

function openSettings(focusKey) {
  syncSettingsUI();
  $settingsTitle.textContent =
    focusKey === "genre"
      ? "Genre / Style"
      : focusKey === "bpm"
        ? "BPM"
        : focusKey === "voice"
          ? "Vocal preset"
          : focusKey === "lang"
            ? "Language"
            : "Quick settings";

  $settingsModal.classList.add("isOpen");
  $settingsModal.setAttribute("aria-hidden", "false");

  // focus best field
  if (focusKey === "bpm") setTimeout(() => $settingsBpm.focus(), 0);
}

function closeSettings() {
  $settingsModal.classList.remove("isOpen");
  $settingsModal.setAttribute("aria-hidden", "true");
}

function resetSettings() {
  state.style = "Cinematic";
  state.mood = "Neon";
  state.language = "en";
  state.vocalPreset = "Radio";
  state.bpm = 128;
  state.vocalMode = "singing_stem";
  state.liveVoiceURI = "";
  syncSettingsUI();
  syncStudioPickersFromState();
  syncQuickButtons();
  renderSongBuilder();
}

function saveSettings() {
  state.bpm = clampNum(Number($settingsBpm.value || 128), 40, 240);
  // chips already set active; read values
  state.style = getModalActive("style") || state.style;
  state.mood = getModalActive("mood") || state.mood;
  state.language = getModalActive("lang") || state.language;
  state.vocalPreset = getModalActive("vocal") || state.vocalPreset;
  state.vocalMode = getModalActive("vocalMode") || state.vocalMode;
  state.liveVoiceURI = $settingsLiveVoice.value || state.liveVoiceURI;

  syncSettingsUI();
  syncStudioPickersFromState();
  syncQuickButtons();
  renderSongBuilder();
  closeSettings();
  setStatus(`Saved: ${state.style} • ${state.mood} • ${state.bpm} BPM • ${state.language} • ${state.vocalPreset}`);
}

function buildSettingsChips() {
  $settingsStyle.innerHTML = "";
  $settingsMood.innerHTML = "";
  $settingsLang.innerHTML = "";
  $settingsVocal.innerHTML = "";

  const styleOpts = ["Cinematic", "Pop", "Hip‑hop", "Electronic", "Rock", "Lo‑Fi"];
  const moodOpts = ["Neon", "Dark", "Hopeful", "Aggressive", "Chill", "Epic"];
  const langOpts = ["en", "af", "de", "es", "fr", "ja", "ko"];
  const vocalOpts = VOICE_PRESETS;

  styleOpts.forEach((v) => $settingsStyle.appendChild(modalChip("style", v)));
  moodOpts.forEach((v) => $settingsMood.appendChild(modalChip("mood", v)));
  langOpts.forEach((v) => $settingsLang.appendChild(modalChip("lang", v)));
  vocalOpts.forEach((v) => $settingsVocal.appendChild(modalChip("vocal", v)));

  $settingsVocalMode.innerHTML = "";
  $settingsVocalMode.classList.add("compact");
  $settingsVocalMode.appendChild(modalChip("vocalMode", "singing_stem"));
  $settingsVocalMode.appendChild(modalChip("vocalMode", "live_voice"));

  // audition buttons
  const auditionRow = el("div", { className: "btnRow" });
  const btnAudStyle = el("button", { className: "btn", type: "button", textContent: "Audition style" });
  const btnAudVocal = el("button", { className: "btn", type: "button", textContent: "Audition vocal" });
  btnAudStyle.onclick = () => auditionStyle(getModalActive("style") || state.style, clampNum(Number($settingsBpm.value || 128), 40, 240));
  btnAudVocal.onclick = () => auditionVocal(getModalActive("lang") || state.language, getModalActive("vocal") || state.vocalPreset);
  auditionRow.appendChild(btnAudStyle);
  auditionRow.appendChild(btnAudVocal);
  $settingsVocal.parentElement?.appendChild(el("div", { className: "divider" }));
  $settingsVocal.parentElement?.appendChild(auditionRow);
}

let auditionCtx = null;
let auditionOscs = [];
let auditionStopTimer = 0;

async function auditionStyle(style, bpm) {
  stopAudition();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  auditionCtx = new AudioCtx();
  await auditionCtx.resume();

  const t0 = auditionCtx.currentTime + 0.03;
  const beat = 60 / bpm;
  const isDark = /dark|hip|trap/i.test(style);
  const base = isDark ? 55 : 65;

  // kick (simple sine burst)
  for (let i = 0; i < 8; i++) {
    const t = t0 + i * beat;
    const o = auditionCtx.createOscillator();
    const g = auditionCtx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.7, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(auditionCtx.destination);
    o.start(t);
    o.stop(t + 0.2);
    auditionOscs.push(o);
  }

  // bass pulse
  for (let i = 0; i < 8; i++) {
    const t = t0 + i * beat;
    const o = auditionCtx.createOscillator();
    const g = auditionCtx.createGain();
    o.type = isDark ? "sawtooth" : "triangle";
    o.frequency.setValueAtTime(base, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(auditionCtx.destination);
    o.start(t);
    o.stop(t + 0.24);
    auditionOscs.push(o);
  }

  setStatus(`Auditioning style: ${style} @ ${bpm} BPM`);
  auditionStopTimer = window.setTimeout(stopAudition, 5000);
}

function auditionVocal(lang, preset) {
  try {
    const u = new SpeechSynthesisUtterance();
    u.lang = lang === "af" ? "af-ZA" : lang === "de" ? "de-DE" : lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : lang === "ja" ? "ja-JP" : lang === "ko" ? "ko-KR" : "en-US";
    u.text =
      preset === "Choir"
        ? "Dieter vocal preview. A cinematic choir tone."
        : preset === "Alien"
          ? "Dieter vocal preview. An alien tone."
          : preset === "Elf"
            ? "Dieter vocal preview. An ethereal tone."
            : `Dieter vocal preview. ${preset} voice.`;
    u.rate = 0.95;
    u.pitch = preset === "Rock" ? 0.85 : preset === "Trap" ? 1.05 : preset === "Alien" ? 1.25 : preset === "Elf" ? 1.15 : 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setStatus(`Auditioning vocal: ${preset} (${lang})`);
  } catch {
    setStatus("Vocal audition not available in this browser.");
  }
}

function stopAudition() {
  if (auditionStopTimer) window.clearTimeout(auditionStopTimer);
  auditionStopTimer = 0;
  if (auditionOscs.length) auditionOscs = [];
  if (auditionCtx) {
    try {
      auditionCtx.close();
    } catch {}
  }
  auditionCtx = null;
}

function modalChip(group, value) {
  const b = el("button", { className: "chip", type: "button", textContent: value });
  b.dataset.modalChipGroup = group;
  b.dataset.modalChipValue = value;
  b.onclick = () => setModalActive(group, value);
  return b;
}

function setModalActive(group, value) {
  /** @type {NodeListOf<HTMLButtonElement>} */
  const all = document.querySelectorAll(`button[data-modal-chip-group="${group}"]`);
  all.forEach((b) => b.classList.toggle("isActive", b.dataset.modalChipValue === value));
}

function getModalActive(group) {
  const b = document.querySelector(`button[data-modal-chip-group="${group}"].isActive`);
  return b ? b.getAttribute("data-modal-chip-value") : "";
}

function syncSettingsUI() {
  $settingsBpm.value = String(state.bpm || 128);
  setModalActive("style", state.style);
  setModalActive("mood", state.mood);
  setModalActive("lang", state.language);
  setModalActive("vocal", state.vocalPreset);
  setModalActive("vocalMode", state.vocalMode);
  if (state.liveVoiceURI) $settingsLiveVoice.value = state.liveVoiceURI;
}

function syncQuickButtons() {
  /** @type {HTMLButtonElement | null} */
  const genreBtn = document.querySelector("button[data-chip='genre']");
  /** @type {HTMLButtonElement | null} */
  const bpmBtn = document.querySelector("button[data-chip='bpm']");
  /** @type {HTMLButtonElement | null} */
  const voiceBtn = document.querySelector("button[data-chip='voice']");
  /** @type {HTMLButtonElement | null} */
  const langBtn = document.querySelector("button[data-chip='lang']");

  if (genreBtn) genreBtn.textContent = `Genre: ${state.style}`;
  if (bpmBtn) bpmBtn.textContent = `BPM: ${state.bpm}`;
  if (voiceBtn) voiceBtn.textContent = `Voice: ${state.vocalPreset}`;
  if (langBtn) langBtn.textContent = `Lang: ${state.language}`;
}

function syncStudioPickersFromState() {
  setActiveChip("style", state.style);
  setActiveChip("mood", state.mood);
  setActiveChip("language", state.language);
  setActiveChip("vocal", state.vocalPreset);
  const dur = /** @type {HTMLInputElement | null} */ (document.querySelector("[data-duration-sec]"));
  if (dur && !dur.value) dur.value = "30";
}

function parseBpm(text) {
  const m = text.toLowerCase().match(/(\d{2,3})\s*bpm/);
  if (!m) return 0;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : 0;
}

async function runBackendGenerate({ prompt, lyrics, bpm, mood, style, language, vocalPreset }) {
  const base = "http://127.0.0.1:8787";
  const trpc = "http://127.0.0.1:8790/trpc";
  const durInput = /** @type {HTMLInputElement | null} */ (document.querySelector("[data-duration-sec]"));
  const durationSec = durInput ? Number(durInput.value || 45) : 45;

  const plan = await trpcCall(trpc, "musicPlan", { prompt, lyrics, bpm, mood });
  const planPre = document.querySelector("[data-plan-json]");
  if (planPre) planPre.textContent = JSON.stringify(plan, null, 2);

  const gen = await trpcCall(trpc, "musicGenerate", {
    prompt,
    lyrics,
    bpm,
    mood,
    style,
    language,
    vocalPreset,
    modelLine: state.modelLine,
    tier: state.tier,
    stems: state.stems,
    durationSec: Math.max(5, Math.min(240, Math.floor(durationSec || 45))),
  });
  const jobId = gen.jobId;
  setStatus(`Job created: ${jobId} (polling…)`);

  // poll
  const started = Date.now();
  while (true) {
    const job = await trpcCall(trpc, "job", { jobId });
    if (job.status === "succeeded") {
      const outPre = document.querySelector("[data-output-json]");
      if (outPre) outPre.textContent = JSON.stringify(job.output, null, 2);

      // Add a playable <audio> for the mix
      const mount = document.querySelector("[data-output-player]");
      if (mount) {
        mount.innerHTML = "";
        const a = document.createElement("audio");
        a.controls = true;
        a.src = `${base}${job.output.mix.wavUrl}`;
        mount.appendChild(a);
      }

      // Stem mixer (WebAudio) — uses stems if present
      try {
        await mixerLoadFromJob({ baseUrl: base, output: job.output });
      } catch (e) {
        const m = document.querySelector("[data-mixer-status]");
        if (m) m.textContent = `Mixer: couldn't load stems (${String(e?.message || e)})`;
      }

      // Save session snapshot to Library
      try {
        saveSession({
          baseUrl: base,
          prompt,
          lyrics,
          settings: {
            bpm,
            mood,
            style,
            language,
            vocalPreset,
            modelLine: state.modelLine,
            tier: state.tier,
            stems: state.stems,
            durationSec: Math.max(5, Math.min(240, Math.floor(durationSec || 45))),
          },
          plan,
          output: job.output,
        });
        const m = document.querySelector("[data-mixer-status]");
        if (m && m.textContent?.startsWith?.("Mixer:")) m.textContent += " • Session saved.";
      } catch {}

      const analysis = job.output?.meta?.analysis;
      const anMount = document.querySelector("[data-analysis]");
      if (anMount && analysis) {
        anMount.textContent = `Peak ${analysis.mixPeakDb.toFixed(1)} dBFS • RMS ${analysis.mixRmsDb.toFixed(1)} dBFS • ${job.output.meta.durationSec}s`;
      }

      // Beat detection + smoother analysis (client-side)
      if (anMount) {
        try {
          const mixUrl = `${base}${job.output.mix.wavUrl}`;
          const det = await analyzeBeats(mixUrl);
          if (det.bpm) {
            anMount.textContent += ` • Detected ${det.bpm.toFixed(1)} BPM`;
          }
        } catch {
          // ignore analysis failures
        }
      }

      // Live voice mode (device voices) — speaks lyrics on-beat
      if (state.vocalMode === "live_voice" && state.lyrics) {
        performLiveVoice(state.lyrics, state.language, state.liveVoiceURI, bpm);
      }

      setStatus(`Done. Generated WAV + ${job.output.stems?.length || 0} stems.`);
      return;
    }
    if (job.status === "failed") throw new Error(job.error || "Job failed");
    if (Date.now() - started > 120000) throw new Error("Timed out waiting for job");
    await sleep(750);
  }
}

function initLiveVoices() {
  const load = () => {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    $settingsLiveVoice.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Auto (default voice)";
    $settingsLiveVoice.appendChild(opt0);
    voices.forEach((v) => {
      const o = document.createElement("option");
      o.value = v.voiceURI;
      o.textContent = `${v.name} (${v.lang})`;
      $settingsLiveVoice.appendChild(o);
    });
    if (state.liveVoiceURI) $settingsLiveVoice.value = state.liveVoiceURI;
  };
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = load;
    load();
  }
}

function performLiveVoice(lyrics, lang, voiceURI, bpm) {
  try {
    window.speechSynthesis.cancel();
    const lines = lyrics
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (!lines.length) return;

    const beatMs = (60_000 / bpm) * 2; // every 2 beats
    let i = 0;
    const tick = () => {
      if (i >= lines.length) return;
      const u = new SpeechSynthesisUtterance(lines[i]);
      u.lang =
        lang === "af"
          ? "af-ZA"
          : lang === "de"
            ? "de-DE"
            : lang === "es"
              ? "es-ES"
              : lang === "fr"
                ? "fr-FR"
                : lang === "ja"
                  ? "ja-JP"
                  : lang === "ko"
                    ? "ko-KR"
                    : "en-US";
      const voices = window.speechSynthesis.getVoices();
      if (voiceURI) {
        const v = voices.find((x) => x.voiceURI === voiceURI);
        if (v) u.voice = v;
      } else {
        const v = voices.find((x) => x.lang?.toLowerCase?.().startsWith(u.lang.toLowerCase().slice(0, 2)));
        if (v) u.voice = v;
      }
      u.rate = 0.95;
      u.pitch = 1.02;
      window.speechSynthesis.speak(u);
      i += 1;
      setTimeout(tick, beatMs);
    };
    setTimeout(tick, 200);
  } catch {}
}

async function analyzeBeats(url) {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  const buf = await (await fetch(url)).arrayBuffer();
  const audio = await ctx.decodeAudioData(buf.slice(0));
  const data = audio.getChannelData(0);
  const sr = audio.sampleRate;

  // energy envelope
  const hop = 512;
  const win = 1024;
  const env = [];
  for (let i = 0; i + win < data.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < win; j++) {
      const x = data[i + j];
      sum += x * x;
    }
    env.push(sum / win);
  }

  // autocorrelation for bpm
  const minBpm = 60;
  const maxBpm = 180;
  const minLag = Math.floor((60 / maxBpm) * sr / hop);
  const maxLag = Math.floor((60 / minBpm) * sr / hop);
  let bestLag = 0;
  let best = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let c = 0;
    for (let i = 0; i + lag < env.length; i++) c += env[i] * env[i + lag];
    if (c > best) {
      best = c;
      bestLag = lag;
    }
  }
  const bpm = bestLag ? (60 * sr) / (bestLag * hop) : 0;
  try { await ctx.close(); } catch {}
  return { bpm };
}

async function trpcCall(baseUrl, procedure, input) {
  // tRPC v11 HTTP transport (JSON)
  const url = `${baseUrl}/${procedure}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error(`tRPC ${procedure} failed (${res.status})`);
  const data = await res.json();
  if (data?.error) throw new Error(data.error.message || "tRPC error");
  // response shape: { result: { data: { json: ... } } }
  return data?.result?.data?.json ?? data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function setStatus(msg) {
  $status.textContent = msg;
}

function renderStudio() {
  const wrap = el("div", { className: "routeMount" });

  wrap.appendChild(
    card(
      "Studio layout",
      "Timeline + tracks on the left, AI tools on the right, mixer at the bottom. This is the shell you’ll connect to Web Audio + backend later."
    )
  );

  const banner = el("div", { className: "panel card" });
  banner.appendChild(el("h3", { className: "card__title", textContent: "Models + Pipeline (O1 / V6 / V7 / V7.5 / V8)" }));
  banner.appendChild(
    el("p", {
      className: "card__muted",
      textContent:
        "Pick a model line and tier. Generate produces a MusiCoT plan JSON + streaming/stems-ready output JSON (API-shaped).",
    })
  );

  const selRow = el("div", { className: "subRow" });
  selRow.appendChild(
    field(
      "Model line",
      (() => {
        const s = el("select", { className: "input" });
        s.dataset.modelLine = "true";
        ["O1", "V6", "V7", "V7.5", "V8"].forEach((v) => s.appendChild(el("option", { textContent: v, value: v })));
        s.value = state.modelLine;
        return s;
      })()
    )
  );
  selRow.appendChild(
    field(
      "Tier",
      (() => {
        const s = el("select", { className: "input" });
        s.dataset.tier = "true";
        ["free", "creator", "pro", "studio"].forEach((v) => s.appendChild(el("option", { textContent: v, value: v })));
        s.value = state.tier;
        return s;
      })()
    )
  );
  selRow.appendChild(
    field(
      "Streaming",
      (() => {
        const s = el("select", { className: "input" });
        s.dataset.streaming = "true";
        [
          { v: "hls", l: "HLS (m3u8)" },
          { v: "range", l: "HTTP range (mp3/wav)" },
        ].forEach((o) => s.appendChild(el("option", { textContent: o.l, value: o.v })));
        s.value = state.streaming;
        return s;
      })()
    )
  );
  selRow.appendChild(
    field(
      "Input layer",
      (() => {
        const s = el("select", { className: "input" });
        s.dataset.inputType = "true";
        [
          { v: "text", l: "Prompt / lyrics / mood" },
          { v: "reference_audio", l: "Reference track (future)" },
          { v: "youtube_link", l: "YouTube link (future)" },
          { v: "humming", l: "Humming melody (future)" },
        ].forEach((o) => s.appendChild(el("option", { textContent: o.l, value: o.v })));
        s.value = "text";
        return s;
      })()
    )
  );
  selRow.appendChild(
    field(
      "Duration (sec)",
      (() => {
        const i = el("input", { className: "input", type: "number", value: "30" });
        i.dataset.durationSec = "true";
        return i;
      })()
    )
  );
  banner.appendChild(selRow);

  // Quick pickers (buttons)
  banner.appendChild(el("div", { className: "divider" }));
  banner.appendChild(el("h3", { className: "card__title", textContent: "Quick pickers" }));
  banner.appendChild(
    pickerRow("Style", "style", ["Cinematic", "Pop", "Hip‑hop", "Electronic", "Rock", "Lo‑Fi"], state.style)
  );
  banner.appendChild(
    pickerRow("Mood", "mood", ["Neon", "Dark", "Hopeful", "Aggressive", "Chill", "Epic"], state.mood)
  );
  banner.appendChild(
    pickerRow("Language", "language", ["en", "af", "de", "es", "fr", "ja", "ko"], state.language)
  );
  banner.appendChild(pickerRow("Vocals", "vocal", VOICE_PRESETS, state.vocalPreset));

  banner.appendChild(
    el("div", {
      className: "check",
      children: [
        (() => {
          const i = el("input", { type: "checkbox" });
          i.dataset.stems = "true";
          i.checked = state.stems;
          return i;
        })(),
        el("div", { className: "card__muted", textContent: "Stem-based workflow (drums/bass/keys/vocals/fx)" }),
      ],
    })
  );

  banner.appendChild(el("div", { className: "divider" }));
  banner.appendChild(el("div", { className: "tagRow", dataset: { pipelineTags: "true" } }));

  banner.appendChild(
    el("div", {
      className: "kpiRow",
      children: [
        kpi("Project", state.projectName),
        kpi("Planner", "MusiCoT planSong"),
        kpi("Core engine", "Neural generator"),
        kpi("Mix layer", "Multi-track + mastering"),
        kpi("Platform", "REST + agents"),
      ],
    })
  );
  banner.appendChild(
    el("div", {
      className: "status",
      dataset: { studioBanner: "true" },
      textContent: "Planned: —",
    })
  );
  wrap.appendChild(banner);

  const lyricsCard = el("div", { className: "panel card" });
  lyricsCard.appendChild(el("h3", { className: "card__title", textContent: "Lyrics" }));
  lyricsCard.appendChild(
    el("p", {
      className: "card__muted",
      textContent:
        "Write your lyrics here (Verse / Hook / Bridge). This will be used for real vocal generation when the vocal model is connected.",
    })
  );
  const lyrics = document.createElement("textarea");
  lyrics.className = "thought__input";
  lyrics.placeholder = "Verse 1...\n\nHook...\n\nVerse 2...\n\nBridge...";
  lyrics.dataset.lyricsInput = "true";
  lyrics.value = state.lyrics || "";
  lyrics.addEventListener("input", () => {
    state.lyrics = lyrics.value;
  });
  lyricsCard.appendChild(lyrics);
  const lyrRow = el("div", { className: "thought__row" });
  const left = el("div", { className: "chipRow" });
  left.appendChild(
    el("button", {
      className: "chip",
      type: "button",
      textContent: "Expand lyrics",
      onclick: () => openLyricsWriter(),
    })
  );
  lyrRow.appendChild(left);
  lyricsCard.appendChild(lyrRow);
  wrap.appendChild(lyricsCard);

  const inspector = el("div", { className: "grid2" });
  const planCard = el("div", { className: "panel card" });
  planCard.appendChild(el("h3", { className: "card__title", textContent: "MusiCoT plan JSON" }));
  planCard.appendChild(
    el("pre", {
      className: "pre",
      dataset: { planJson: "true" },
      textContent: "Generate to see plan JSON…",
    })
  );
  inspector.appendChild(planCard);

  const outCard = el("div", { className: "panel card" });
  outCard.appendChild(el("h3", { className: "card__title", textContent: "Engine output JSON" }));
  outCard.appendChild(el("div", { className: "status", dataset: { outputPlayer: "true" }, textContent: "" }));
  outCard.appendChild(el("div", { className: "status", dataset: { analysis: "true" }, textContent: "" }));
  outCard.appendChild(
    el("pre", {
      className: "pre",
      dataset: { outputJson: "true" },
      textContent: "Generate to see output JSON…",
    })
  );
  inspector.appendChild(outCard);
  wrap.appendChild(inspector);

  wrap.appendChild(card("Timeline & bars (next)", "Next: bar ruler + playhead + markers synced to plan JSON."));

  const mixerCard = el("div", { className: "panel card" });
  mixerCard.appendChild(el("h3", { className: "card__title", textContent: "Mixer (stems)" }));
  mixerCard.appendChild(
    el("p", {
      className: "card__muted",
      textContent:
        "Generate with stems enabled to get a real mixer. Faders + mute/solo change what you hear using Web Audio.",
    })
  );
  const mixTop = el("div", { className: "toolbar" });
  mixTop.appendChild(
    el("div", {
      className: "btnRow",
      children: [
        el("button", { className: "btn btn--primary", type: "button", textContent: "Play", onclick: () => mixerPlay() }),
        el("button", { className: "btn btn--ghost", type: "button", textContent: "Stop", onclick: () => mixerStop() }),
      ],
    })
  );
  const masterSlider = el("input", { className: "mixerFader", type: "range", min: "-60", max: "6", step: "0.5", value: "0" });
  masterSlider.oninput = () => {
    mixer.masterDb = Number(masterSlider.value || 0);
    mixerApplyGains();
    const v = document.querySelector("[data-master-db]");
    if (v) v.textContent = `${mixer.masterDb.toFixed(1)} dB`;
  };
  mixTop.appendChild(
    el("div", {
      className: "field",
      style: "min-width:240px",
      children: [
        el("div", { className: "label", textContent: "Master" }),
        masterSlider,
        el("div", { className: "mixerValue", dataset: { masterDb: "true" }, textContent: "0.0 dB" }),
      ],
    })
  );
  mixerCard.appendChild(mixTop);
  mixerCard.appendChild(el("div", { className: "status", dataset: { mixerStatus: "true" }, textContent: "Mixer: waiting for stems…" }));
  mixerCard.appendChild(el("div", { className: "mixerGrid", dataset: { mixerGrid: "true" } }));
  wrap.appendChild(mixerCard);

  const controls = el("div", { className: "panel card" });
  controls.appendChild(el("h3", { className: "card__title", textContent: "Controls layout" }));
  controls.appendChild(
    el("p", {
      className: "card__muted",
      textContent:
        "Reference layout image. The working mixer is above (stems).",
    })
  );
  const img = document.createElement("img");
  img.src = "./assets/controls-layout.svg";
  img.alt = "Controls layout";
  img.style.width = "100%";
  img.style.borderRadius = "14px";
  img.style.border = "1px solid rgba(255,255,255,0.10)";
  img.style.background = "rgba(0,0,0,0.16)";
  controls.appendChild(img);
  wrap.appendChild(controls);

  return wrap;
}

function mixerEnsureCtx() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!mixer.ctx) mixer.ctx = new AudioCtx();
  if (!mixer.master) mixer.master = mixer.ctx.createGain();
  if (!mixer.analyser) {
    mixer.analyser = mixer.ctx.createAnalyser();
    mixer.analyser.fftSize = 1024;
    mixer.analyser.smoothingTimeConstant = 0.85;
    mixer.analyserBins = new Uint8Array(mixer.analyser.frequencyBinCount);
  }
  mixer.master.gain.value = 1;
  // Route: master -> analyser -> destination (so universe can "listen")
  try {
    mixer.master.disconnect();
  } catch {}
  mixer.master.connect(mixer.analyser);
  mixer.analyser.connect(mixer.ctx.destination);
  return mixer.ctx;
}

function mixerReset() {
  mixer.tracks = {};
  mixer.buses = {};
  mixer.trackBus = {};
  mixer.sources = {};
  mixer.playing = false;
  mixer.order = [];
  mixer.masterDb = 0;
  // keep ctx/analyser around for visuals
  const grid = document.querySelector("[data-mixer-grid]");
  if (grid) grid.innerHTML = "";
  const st = document.querySelector("[data-mixer-status]");
  if (st) st.textContent = "Mixer: waiting for stems…";
  const md = document.querySelector("[data-master-db]");
  if (md) md.textContent = "0.0 dB";
}

// --- Universe background (canvas overlay listening to mixer analyser) ---
const universe = {
  w: 0,
  h: 0,
  dpr: 1,
  stars: /** @type {{x:number,y:number,z:number,tw:number}[]} */ ([]),
  lastT: 0,
};

function universeInit() {
  const resize = () => {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    universe.dpr = dpr;
    universe.w = Math.max(1, Math.floor($app.clientWidth));
    universe.h = Math.max(1, Math.floor($app.clientHeight));
    $universeCanvas.width = Math.floor(universe.w * dpr);
    $universeCanvas.height = Math.floor(universe.h * dpr);
    $universeCanvas.style.width = `${universe.w}px`;
    $universeCanvas.style.height = `${universe.h}px`;

    const n = Math.floor(Math.min(420, Math.max(140, (universe.w * universe.h) / 8000)));
    universe.stars = [];
    for (let i = 0; i < n; i++) {
      universe.stars.push({
        x: Math.random() * universe.w,
        y: Math.random() * universe.h,
        z: 0.25 + Math.random() * 0.85,
        tw: Math.random() * Math.PI * 2,
      });
    }
  };
  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(universeTick);
}

function getAudioEnergy() {
  const ctx = mixer.ctx;
  const an = mixer.analyser;
  const bins = mixer.analyserBins;
  if (!ctx || !an || !bins) return { low: 0, mid: 0, high: 0, rms: 0 };
  try {
    an.getByteFrequencyData(bins);
  } catch {
    return { low: 0, mid: 0, high: 0, rms: 0 };
  }
  const n = bins.length || 1;
  const a = (from, to) => {
    let s = 0;
    const lo = Math.max(0, Math.min(n - 1, from));
    const hi = Math.max(lo + 1, Math.min(n, to));
    for (let i = lo; i < hi; i++) s += bins[i];
    return s / (hi - lo) / 255;
  };
  const low = a(0, Math.floor(n * 0.12)); // kick/bass energy
  const mid = a(Math.floor(n * 0.12), Math.floor(n * 0.45));
  const high = a(Math.floor(n * 0.45), n);
  const rms = (low * 0.55 + mid * 0.30 + high * 0.15);
  return { low, mid, high, rms };
}

function universeTick(t) {
  requestAnimationFrame(universeTick);
  if (!state.universe) return;
  const ctx2d = $universeCanvas.getContext("2d");
  if (!ctx2d) return;

  const dt = Math.min(0.05, Math.max(0.001, (t - (universe.lastT || t)) / 1000));
  universe.lastT = t;

  const { low, mid, high, rms } = getAudioEnergy();
  const dpr = universe.dpr || 1;
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0);

  // fade instead of full clear (smooth trails)
  ctx2d.fillStyle = `rgba(0,0,0,${0.25 + 0.22 * (1 - rms)})`;
  ctx2d.fillRect(0, 0, universe.w, universe.h);

  // gentle parallax + "orbit" on chorus-like energy
  const drift = (0.6 + low * 2.4) * dt * 60;
  const twinkleBoost = 0.25 + high * 0.9;
  const glow = 0.10 + rms * 0.22;

  // glow fog
  const gx = universe.w * (0.5 + 0.08 * Math.sin(t / 2200));
  const gy = universe.h * (0.25 + 0.06 * Math.cos(t / 2500));
  const grad = ctx2d.createRadialGradient(gx, gy, 0, gx, gy, Math.max(universe.w, universe.h) * 0.8);
  grad.addColorStop(0, `rgba(63,210,255,${glow})`);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx2d.fillStyle = grad;
  ctx2d.fillRect(0, 0, universe.w, universe.h);

  for (const s of universe.stars) {
    s.y += drift * s.z;
    s.x += (0.15 + mid * 0.9) * dt * 60 * (0.2 + s.z);
    if (s.y > universe.h + 20) s.y = -20;
    if (s.x > universe.w + 20) s.x = -20;
    s.tw += dt * (0.8 + high * 3.2);

    const tw = (0.55 + 0.45 * Math.sin(s.tw)) * twinkleBoost;
    const r = 0.6 + 1.8 * s.z + 2.6 * low;
    ctx2d.fillStyle = `rgba(234,240,255,${0.22 + 0.55 * tw})`;
    ctx2d.beginPath();
    ctx2d.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx2d.fill();
  }
}

function dbToGain(db) {
  return Math.pow(10, db / 20);
}

function mixerApplyGains() {
  if (mixer.master) mixer.master.gain.value = dbToGain(mixer.masterDb);
  const anyBusSolo = Object.values(mixer.buses).some((b) => b.solo);
  const anyTrackSolo = Object.values(mixer.tracks).some((t) => t.solo);

  Object.entries(mixer.buses).forEach(([busId, b]) => {
    const shouldMuteBus = b.muted || (anyBusSolo && !b.solo);
    b.gain.gain.value = shouldMuteBus ? 0 : dbToGain(b.db);
    const mBtn = document.querySelector(`[data-bus-mute="${busId}"]`);
    if (mBtn) mBtn.classList.toggle("isActive", b.muted);
    const sBtn = document.querySelector(`[data-bus-solo="${busId}"]`);
    if (sBtn) sBtn.classList.toggle("isActive", b.solo);
    const v = document.querySelector(`[data-bus-db="${busId}"]`);
    if (v) v.textContent = `${b.db.toFixed(1)} dB`;
  });

  Object.entries(mixer.tracks).forEach(([id, t]) => {
    const busId = mixer.trackBus[id] || "misc";
    const bus = mixer.buses[busId];
    const soloGate = anyBusSolo ? !!bus?.solo : anyTrackSolo ? t.solo : true;
    const shouldMute = t.muted || !soloGate;
    t.gain.gain.value = shouldMute ? 0 : dbToGain(t.db);
    const elVal = document.querySelector(`[data-track-db="${id}"]`);
    if (elVal) elVal.textContent = `${t.db.toFixed(1)} dB`;
    const mBtn = document.querySelector(`[data-track-mute="${id}"]`);
    if (mBtn) mBtn.classList.toggle("isActive", t.muted);
    const sBtn = document.querySelector(`[data-track-solo="${id}"]`);
    if (sBtn) sBtn.classList.toggle("isActive", t.solo);
  });
}

function guessBusId(id) {
  const k = String(id || "").toLowerCase();
  if (k.includes("drum")) return "drums";
  if (k.includes("bass")) return "bass";
  if (k.includes("key") || k.includes("pad")) return "keys";
  if (k.includes("lead") || k.includes("mel")) return "lead";
  if (k.includes("vox") || k.includes("vocal")) return "vocals";
  if (k.includes("fx")) return "fx";
  return "misc";
}

function ensureBus(ctx, busId) {
  if (mixer.buses[busId]) return mixer.buses[busId];
  const g = ctx.createGain();
  g.gain.value = 1;
  g.connect(mixer.master);
  mixer.buses[busId] = { gain: g, muted: false, solo: false, db: 0 };
  return mixer.buses[busId];
}

async function mixerLoadFromJob({ baseUrl, output }) {
  const stems = output?.stems || [];
  const st = document.querySelector("[data-mixer-status]");
  const grid = document.querySelector("[data-mixer-grid]");
  if (!grid) return;

  mixerStop();
  mixerReset();

  if (!Array.isArray(stems) || stems.length === 0) {
    if (st) st.textContent = "Mixer: no stems in this render (turn on “Stems” and Generate again).";
    return;
  }

  const ctx = mixerEnsureCtx();
  if (ctx.state === "suspended") {
    try { await ctx.resume(); } catch {}
  }

  if (st) st.textContent = `Mixer: loading ${stems.length} stems…`;

  // Prefer a stable order (drums/bass/keys/lead/vocals/fx) if present
  const preferred = ["drums", "bass", "keys", "lead", "vocals", "fx", "mix"];
  const sorted = [...stems].sort((a, b) => {
    const ai = preferred.indexOf(String(a.id || a.name || "").toLowerCase());
    const bi = preferred.indexOf(String(b.id || b.name || "").toLowerCase());
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  for (const s of sorted) {
    const idRaw = String(s.id || s.name || "stem").toLowerCase();
    const id = idRaw.replace(/[^a-z0-9_-]+/g, "_");
    const url = s.wavUrl ? `${baseUrl}${s.wavUrl}` : "";
    if (!url) continue;
    const ab = await (await fetch(url)).arrayBuffer();
    const buf = await ctx.decodeAudioData(ab.slice(0));
    const gain = ctx.createGain();
    gain.gain.value = 1;
    const busId = guessBusId(id);
    const bus = ensureBus(ctx, busId);
    gain.connect(bus.gain);
    mixer.tracks[id] = { buffer: buf, gain, muted: false, solo: false, db: 0 };
    mixer.trackBus[id] = busId;
    mixer.order.push(id);
  }

  grid.innerHTML = "";

  // Bus strips first (so it feels like stems→buses)
  const busOrder = ["drums", "bass", "keys", "lead", "vocals", "fx", "misc"].filter((b) => mixer.buses[b]);
  busOrder.forEach((busId) => {
    const b = mixer.buses[busId];
    const slider = el("input", { className: "mixerFader", type: "range", min: "-60", max: "6", step: "0.5", value: String(b.db) });
    slider.oninput = () => {
      b.db = Number(slider.value || 0);
      mixerApplyGains();
    };
    const muteBtn = el("button", { className: "chip", type: "button", textContent: "Mute" });
    muteBtn.dataset.busMute = busId;
    muteBtn.onclick = () => {
      b.muted = !b.muted;
      mixerApplyGains();
    };
    const soloBtn = el("button", { className: "chip", type: "button", textContent: "Solo" });
    soloBtn.dataset.busSolo = busId;
    soloBtn.onclick = () => {
      b.solo = !b.solo;
      mixerApplyGains();
    };
    grid.appendChild(
      el("div", {
        className: "mixerChan",
        children: [
          el("div", { className: "mixerChan__name", textContent: `${busId.toUpperCase()} BUS` }),
          el("div", { className: "mixerChan__btns", children: [muteBtn, soloBtn] }),
          slider,
          el("div", { className: "mixerValue", dataset: { busDb: busId }, textContent: "0.0 dB" }),
        ],
      })
    );
  });

  // Track strips after buses
  mixer.order.forEach((id) => {
    const t = mixer.tracks[id];
    const slider = el("input", { className: "mixerFader", type: "range", min: "-60", max: "6", step: "0.5", value: String(t.db) });
    slider.oninput = () => {
      t.db = Number(slider.value || 0);
      mixerApplyGains();
    };
    const muteBtn = el("button", { className: "chip", type: "button", textContent: "Mute" });
    muteBtn.dataset.trackMute = id;
    muteBtn.onclick = () => {
      t.muted = !t.muted;
      mixerApplyGains();
    };
    const soloBtn = el("button", { className: "chip", type: "button", textContent: "Solo" });
    soloBtn.dataset.trackSolo = id;
    soloBtn.onclick = () => {
      t.solo = !t.solo;
      mixerApplyGains();
    };
    const busPill = el("div", { className: "tag", textContent: (mixer.trackBus[id] || "misc").toUpperCase() });
    grid.appendChild(
      el("div", {
        className: "mixerChan",
        children: [
          el("div", { className: "mixerChan__name", textContent: id.toUpperCase() }),
          busPill,
          el("div", { className: "mixerChan__btns", children: [muteBtn, soloBtn] }),
          slider,
          el("div", { className: "mixerValue", dataset: { trackDb: id }, textContent: "0.0 dB" }),
        ],
      })
    );
  });

  mixerApplyGains();
  if (st) st.textContent = "Mixer: ready (Play to hear stems).";
}

function mixerPlay() {
  const grid = document.querySelector("[data-mixer-grid]");
  const st = document.querySelector("[data-mixer-status]");
  if (!grid) return;
  const ctx = mixerEnsureCtx();
  if (Object.keys(mixer.tracks).length === 0) {
    if (st) st.textContent = "Mixer: no stems loaded yet. Generate with stems enabled.";
    return;
  }
  if (mixer.playing) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  mixer.sources = {};
  const when = ctx.currentTime + 0.02;
  mixer.order.forEach((id) => {
    const t = mixer.tracks[id];
    const src = ctx.createBufferSource();
    src.buffer = t.buffer;
    src.connect(t.gain);
    src.start(when);
    mixer.sources[id] = src;
  });
  mixer.playing = true;
  if (st) st.textContent = "Mixer: playing…";
}

function mixerStop() {
  const st = document.querySelector("[data-mixer-status]");
  if (!mixer.playing && Object.keys(mixer.sources).length === 0) return;
  Object.values(mixer.sources).forEach((src) => {
    try { src.stop(); } catch {}
    try { src.disconnect(); } catch {}
  });
  mixer.sources = {};
  mixer.playing = false;
  if (st && Object.keys(mixer.tracks).length) st.textContent = "Mixer: ready (Play to hear stems).";
}

function safeJsonParse(s) {
  try { return JSON.parse(String(s || "")); } catch { return null; }
}

function getSessions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const data = safeJsonParse(raw);
  return Array.isArray(data) ? data : [];
}

function setSessions(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 200)));
}

function saveSession({ baseUrl, prompt, lyrics, settings, plan, output }) {
  const now = new Date();
  const id = `sess_${now.getTime().toString(16)}_${Math.floor(Math.random() * 1e8).toString(16)}`;
  const item = {
    id,
    createdAt: now.toISOString(),
    title: (prompt || "Untitled").slice(0, 42),
    prompt,
    lyrics,
    settings,
    plan,
    output,
    baseUrl,
    tags: {
      mood: settings?.mood || "",
      style: settings?.style || "",
      language: settings?.language || "",
      bpm: settings?.bpm || 0,
      vocalPreset: settings?.vocalPreset || "",
      modelLine: settings?.modelLine || "",
    },
  };
  const list = getSessions();
  list.unshift(item);
  setSessions(list);
  return id;
}

function deleteSession(id) {
  const list = getSessions().filter((x) => x?.id !== id);
  setSessions(list);
}

async function loadSessionToStudio(sess) {
  if (!sess) return;
  mixerStop();

  // restore state (best-effort)
  state.bpm = clampNum(Number(sess?.settings?.bpm || state.bpm || 128), 40, 240);
  state.mood = sess?.settings?.mood || state.mood;
  state.style = sess?.settings?.style || state.style;
  state.language = sess?.settings?.language || state.language;
  state.vocalPreset = sess?.settings?.vocalPreset || state.vocalPreset;
  state.modelLine = sess?.settings?.modelLine || state.modelLine;
  state.tier = sess?.settings?.tier || state.tier;
  state.stems = !!sess?.settings?.stems;
  state.lyrics = sess?.lyrics || state.lyrics || "";

  if (state.lastRoute !== "studio") location.hash = "#/studio";
  await sleep(30); // let Studio render mount

  // restore prompt + lyrics input
  $prompt.value = sess?.prompt || "";
  const lyr = /** @type {HTMLTextAreaElement | null} */ (document.querySelector("[data-lyrics-input]"));
  if (lyr) lyr.value = state.lyrics || "";

  // restore select fields
  const modelSel = /** @type {HTMLSelectElement | null} */ (document.querySelector("[data-model-line]"));
  const tierSel = /** @type {HTMLSelectElement | null} */ (document.querySelector("[data-tier]"));
  const stemsChk = /** @type {HTMLInputElement | null} */ (document.querySelector("[data-stems]"));
  const durInput = /** @type {HTMLInputElement | null} */ (document.querySelector("[data-duration-sec]"));
  if (modelSel) modelSel.value = state.modelLine;
  if (tierSel) tierSel.value = state.tier;
  if (stemsChk) stemsChk.checked = state.stems;
  if (durInput && sess?.settings?.durationSec) durInput.value = String(sess.settings.durationSec);

  // restore chips
  setActiveChip("style", state.style);
  setActiveChip("mood", state.mood);
  setActiveChip("language", state.language);
  setActiveChip("vocal", state.vocalPreset);

  // restore plan/output JSON panes
  const planPre = document.querySelector("[data-plan-json]");
  if (planPre && sess?.plan) planPre.textContent = JSON.stringify(sess.plan, null, 2);
  const outPre = document.querySelector("[data-output-json]");
  if (outPre && sess?.output) outPre.textContent = JSON.stringify(sess.output, null, 2);

  // restore mix player
  const base = sess?.baseUrl || "http://127.0.0.1:8787";
  const mount = document.querySelector("[data-output-player]");
  if (mount && sess?.output?.mix?.wavUrl) {
    mount.innerHTML = "";
    const a = document.createElement("audio");
    a.controls = true;
    a.src = `${base}${sess.output.mix.wavUrl}`;
    mount.appendChild(a);
  }

  // restore mixer
  try {
    if (sess?.output) await mixerLoadFromJob({ baseUrl: base, output: sess.output });
  } catch {}

  setStatus(`Loaded session: ${sess?.title || sess?.id || "session"}`);
}

function pickerRow(label, groupKey, options, active) {
  const row = el("div", { className: "field" });
  row.appendChild(el("div", { className: "label", textContent: label }));
  const chips = el("div", { className: "chipRow" });
  options.forEach((opt) => {
    const b = el("button", { className: "chip", type: "button", textContent: opt });
    b.dataset.chipGroup = groupKey;
    b.dataset.chipValue = opt;
    if (opt === active) b.classList.add("isActive");
    b.onclick = () => {
      setActiveChip(groupKey, opt);
    };
    chips.appendChild(b);
  });
  row.appendChild(chips);
  return row;
}

function setActiveChip(groupKey, value) {
  /** @type {NodeListOf<HTMLButtonElement>} */
  const all = document.querySelectorAll(`button[data-chip-group="${groupKey}"]`);
  all.forEach((b) => b.classList.toggle("isActive", b.dataset.chipValue === value));

  // keep settings modal + quick buttons in sync
  if (groupKey === "style") state.style = value;
  if (groupKey === "mood") state.mood = value;
  if (groupKey === "language") state.language = value;
  if (groupKey === "vocal") state.vocalPreset = value;
  syncSettingsUI();
  syncQuickButtons();
}

function getActiveChipValue(groupKey) {
  const b = document.querySelector(`button[data-chip-group="${groupKey}"].isActive`);
  return b ? b.getAttribute("data-chip-value") : "";
}

function buildPlan({ text, bpm, mood, seed }) {
  const section = (id, startBar, lenBar) => ({
    id,
    start_bar: startBar,
    length_bar: lenBar,
    start_s: Math.round(((startBar * 60) / bpm) * 4 * 10) / 10,
    length_s: Math.round(((lenBar * 60) / bpm) * 4 * 10) / 10,
  });

  const intro = section("intro", 0, 4);
  const verse1 = section("verse1", 4, 8);
  const hook = section("hook", 12, 8);
  const verse2 = section("verse2", 20, 8);
  const bridge = section("bridge", 28, 8);
  const hook2 = section("hook2", 36, 8);
  const outro = section("outro", 44, 8);

  return {
    planId: `plan_${seed.toString(16)}`,
    bpm,
    mood,
    inputTextPreview: text ? text.slice(0, 180) : "",
    structure: [intro, verse1, hook, verse2, bridge, hook2, outro],
    chords: [
      { section: "verse1", progression: ["Am7", "Fmaj7", "Cmaj7", "G7"] },
      { section: "hook", progression: ["Fmaj7", "G", "Am7", "Em7"] },
      { section: "bridge", progression: ["Dm7", "G7", "Cmaj7", "Am7"] },
    ],
    lyricSections: [
      { section: "verse1", intent: "set the scene", hookLine: null },
      { section: "hook", intent: "repeatable hook", hookLine: "short + memorable line" },
      { section: "bridge", intent: "twist / emotional lift", hookLine: null },
    ],
  };
}

function buildResult({ plan, modelLine, tier, streaming, stems }) {
  const baseId = plan.planId.replace("plan_", "asset_");
  const commercialUseAllowed = tier !== "free";
  const stream =
    streaming === "hls"
      ? { type: "hls", url: `https://cdn.dieter.local/${baseId}/track.m3u8` }
      : { type: "range", url: `https://cdn.dieter.local/${baseId}/track.mp3` };

  const out = {
    model: {
      line: modelLine,
      version: modelLine === "V7.5" ? "7.5" : modelLine === "V8" ? "8.0" : modelLine.toLowerCase(),
      notes:
        modelLine === "O1"
          ? "Songwriting-focused (lyrics + structure)"
          : modelLine === "V7.5"
            ? "High-fidelity vocals, multi-layering, longer tracks"
            : "Structure-aware music generator",
    },
    tier,
    licensing: {
      commercialUseAllowed,
      licenseId: commercialUseAllowed ? `lic_${baseId}` : null,
    },
    job: {
      pattern: "async",
      create: "POST /api/music/generate",
      poll: "GET /api/jobs/{jobId}",
    },
    stream,
    mix: {
      wavUrl: `https://cdn.dieter.local/${baseId}/mix.wav`,
      mp3Url: `https://cdn.dieter.local/${baseId}/mix.mp3`,
    },
    stems: stems
      ? [
          { name: "drums", wavUrl: `https://cdn.dieter.local/${baseId}/stems/drums.wav` },
          { name: "bass", wavUrl: `https://cdn.dieter.local/${baseId}/stems/bass.wav` },
          { name: "keys", wavUrl: `https://cdn.dieter.local/${baseId}/stems/keys.wav` },
          { name: "vocals", wavUrl: `https://cdn.dieter.local/${baseId}/stems/vocals.wav` },
          { name: "fx", wavUrl: `https://cdn.dieter.local/${baseId}/stems/fx.wav` },
        ]
      : [],
    structure: {
      planId: plan.planId,
      sections: plan.structure,
    },
    timedLyrics: [
      { t_s: plan.structure[1].start_s, text: "Verse starts…" },
      { t_s: plan.structure[2].start_s, text: "Hook starts…" },
    ],
    conditioning: {
      text: true,
      referenceAudio: false,
      youtubeLink: false,
      humming: false,
      embeddings: "CLAP-style (backend)",
    },
    vocals: {
      multiLanguage: true,
      languages: ["en", "ko", "ja", "es", "de", "af"],
      voicePresets: ["male", "female", "radio", "rock", "trap", "choir", "alien", "elf"],
    },
  };

  return out;
}

function renderVideo() {
  const wrap = el("div", { className: "routeMount" });

  const layout = el("div", { className: "grid2Wide" });

  const left = el("div", { className: "panel card" });
  left.appendChild(el("h3", { className: "card__title", textContent: "Beat-synced video generator" }));
  left.appendChild(
    el("p", {
      className: "card__muted",
      textContent:
        "Upload a song, set BPM, and export a simple synced WebM. (Perfect for previews and portal workflows.)",
    })
  );

  const canvasWrap = el("div", { className: "canvasWrap" });
  const canvas = el("canvas", {});
  canvas.width = 1280;
  canvas.height = 720;
  canvasWrap.appendChild(canvas);
  left.appendChild(canvasWrap);

  const controls = el("div", { className: "subRow" });
  const fileField = field("Song file", el("input", { type: "file", className: "input" }));
  fileField.querySelector("input").accept = "audio/*";

  const bpmField = field(
    "BPM",
    el("input", { className: "input", type: "number", placeholder: "128", value: "128" })
  );
  const durField = field(
    "Video length (sec)",
    el("input", { className: "input", type: "number", placeholder: "15", value: "15" })
  );
  controls.appendChild(fileField);
  controls.appendChild(bpmField);
  controls.appendChild(durField);
  left.appendChild(controls);

  const btnRow = el("div", { className: "btnRow" });
  const btnPreview = el("button", { className: "btn", type: "button", textContent: "Preview" });
  const btnRecord = el("button", {
    className: "btn btn--primary",
    type: "button",
    textContent: "Record WebM",
  });
  const btnStop = el("button", { className: "btn btn--ghost", type: "button", textContent: "Stop" });
  btnRow.appendChild(btnPreview);
  btnRow.appendChild(btnRecord);
  btnRow.appendChild(btnStop);
  left.appendChild(btnRow);

  left.appendChild(
    el("div", {
      className: "hint",
      textContent:
        "Workflow: Export WAV in Workshop → generate a synced WebM here → open YouTube Studio to upload.",
    })
  );

  const downloadWrap = el("div", { className: "status" });
  left.appendChild(downloadWrap);

  const right = el("div", { className: "routeMount" });
  right.appendChild(
    card(
      "AI video (future)",
      "For cinematic generation (Veo/Runway/etc.), DIETER will send BPM + mood + beat markers to a backend service."
    )
  );
  right.appendChild(
    card(
      "Real vocals (future)",
      "Real singing voices require a server model (TTS/VC). DIETER will generate a vocal stem + timed lyrics JSON and mix it in."
    )
  );
  right.appendChild(
    card(
      "Collaboration (future)",
      "Comments, tasks, and versioned approvals will live here. For now, this page focuses on synced video exports."
    )
  );

  layout.appendChild(left);
  layout.appendChild(right);
  wrap.appendChild(layout);

  wireVideoSync({
    canvas,
    fileInput: /** @type {HTMLInputElement} */ (fileField.querySelector("input")),
    bpmInput: /** @type {HTMLInputElement} */ (bpmField.querySelector("input")),
    durInput: /** @type {HTMLInputElement} */ (durField.querySelector("input")),
    btnPreview,
    btnRecord,
    btnStop,
    downloadWrap,
  });

  return wrap;
}

function renderWorkshop() {
  const wrap = el("div", { className: "routeMount" });

  const layout = el("div", { className: "grid2Wide" });

  const left = el("div", { className: "panel card" });
  left.appendChild(el("h3", { className: "card__title", textContent: "Digital Workshop" }));
  left.appendChild(
    el("p", {
      className: "card__muted",
      textContent:
        "Upload an audio file, trim/shorten it, add fade-in/out, and export a clean WAV for publishing portals.",
    })
  );

  const canvasWrap = el("div", { className: "canvasWrap" });
  const canvas = el("canvas", {});
  canvas.width = 1280;
  canvas.height = 240;
  canvasWrap.appendChild(canvas);
  left.appendChild(canvasWrap);

  const controls = el("div", { className: "panel panel--soft card" });
  const fileField = field("Upload song", el("input", { type: "file", className: "input" }));
  fileField.querySelector("input").accept = "audio/*";

  const startField = field("Start (sec)", el("input", { className: "input", type: "number", value: "0" }));
  const endField = field("End (sec)", el("input", { className: "input", type: "number", value: "30" }));
  const fadeInField = field("Fade in (sec)", el("input", { className: "input", type: "number", value: "0.5" }));
  const fadeOutField = field("Fade out (sec)", el("input", { className: "input", type: "number", value: "1.5" }));

  const grid = el("div", { className: "subRow" });
  grid.appendChild(startField);
  grid.appendChild(endField);
  grid.appendChild(fadeInField);
  grid.appendChild(fadeOutField);

  controls.appendChild(fileField);
  controls.appendChild(grid);

  const btnRow = el("div", { className: "btnRow" });
  const btnPlay = el("button", { className: "btn", type: "button", textContent: "Play selection" });
  const btnStop = el("button", { className: "btn btn--ghost", type: "button", textContent: "Stop" });
  const btnProcess = el("button", {
    className: "btn btn--primary",
    type: "button",
    textContent: "Process + Export WAV",
  });
  btnRow.appendChild(btnPlay);
  btnRow.appendChild(btnStop);
  btnRow.appendChild(btnProcess);
  controls.appendChild(btnRow);

  const out = el("div", { className: "status" });
  controls.appendChild(out);

  left.appendChild(controls);

  const right = el("div", { className: "routeMount" });
  right.appendChild(
    card(
      "Fade + shorten",
      "Fades prevent clicks. Shorten songs for radio edits, TikTok highlights, or tight hooks."
    )
  );
  right.appendChild(
    card(
      "Multi-track synthesis (backend)",
      "DIETER’s backend will output stems (drums/bass/keys/vocals/FX) and then run mixing/mastering as a separate step."
    )
  );

  layout.appendChild(left);
  layout.appendChild(right);
  wrap.appendChild(layout);

  wireWorkshop({
    canvas,
    fileInput: /** @type {HTMLInputElement} */ (fileField.querySelector("input")),
    startInput: /** @type {HTMLInputElement} */ (startField.querySelector("input")),
    endInput: /** @type {HTMLInputElement} */ (endField.querySelector("input")),
    fadeInInput: /** @type {HTMLInputElement} */ (fadeInField.querySelector("input")),
    fadeOutInput: /** @type {HTMLInputElement} */ (fadeOutField.querySelector("input")),
    btnPlay,
    btnStop,
    btnProcess,
    out,
  });

  return wrap;
}

function renderLibrary() {
  const wrap = el("div", { className: "routeMount" });

  const bar = el("div", { className: "panel card" });
  bar.appendChild(el("h3", { className: "card__title", textContent: "My Catalog" }));

  const toolbar = el("div", { className: "toolbar" });
  const q = el("input", {
    className: "input",
    type: "text",
    placeholder: "Search: style, mood, language, BPM, vocal…",
  });
  toolbar.appendChild(q);
  toolbar.appendChild(
    el("button", {
      className: "btn btn--primary",
      type: "button",
      textContent: "Export ZIP bundle",
      onclick: () => setStatus("Would queue: stems ZIP + license PDF (stub)."),
    })
  );
  toolbar.appendChild(
    el("button", {
      className: "btn btn--ghost",
      type: "button",
      textContent: "Clear Library",
      onclick: () => {
        setSessions([]);
        onRouteChange();
        setStatus("Library cleared.");
      },
    })
  );
  bar.appendChild(toolbar);
  wrap.appendChild(bar);

  const grid = el("div", { className: "grid3" });
  const list = getSessions();

  const renderList = () => {
    const term = (q.value || "").trim().toLowerCase();
    grid.innerHTML = "";
    const filtered = term
      ? list.filter((s) => {
          const t = JSON.stringify(s?.tags || {}).toLowerCase();
          const p = String(s?.title || "").toLowerCase();
          return t.includes(term) || p.includes(term);
        })
      : list;

    if (!filtered.length) {
      grid.appendChild(
        card(
          "No sessions yet",
          "Go to Studio → Generate (with Stems on). Every render is saved here as audio URLs + JSON session."
        )
      );
      return;
    }

    filtered.slice(0, 60).forEach((s) => {
      const meta = `${s?.tags?.style || "—"} • ${s?.tags?.mood || "—"} • ${s?.tags?.language || "—"} • ${
        s?.tags?.bpm || "—"
      } BPM • ${s?.tags?.vocalPreset || "—"} • ${s?.tags?.modelLine || "—"}`;
      const c = el("div", { className: "panel card" });
      c.appendChild(el("h3", { className: "card__title", textContent: s?.title || "Untitled" }));
      c.appendChild(el("p", { className: "card__muted", textContent: meta }));
      c.appendChild(
        el("p", {
          className: "hint",
          textContent: new Date(s?.createdAt || Date.now()).toLocaleString(),
        })
      );
      c.appendChild(
        el("div", {
          className: "btnRow",
          children: [
            el("button", { className: "btn btn--primary", type: "button", textContent: "Open in Studio", onclick: () => loadSessionToStudio(s) }),
            el("button", {
              className: "btn btn--ghost",
              type: "button",
              textContent: "Delete",
              onclick: () => {
                deleteSession(s.id);
                onRouteChange();
                setStatus("Deleted session.");
              },
            }),
          ],
        })
      );
      grid.appendChild(c);
    });
  };

  q.oninput = renderList;
  renderList();
  wrap.appendChild(grid);

  return wrap;
}

function renderPublish() {
  const wrap = el("div", { className: "routeMount" });

  wrap.appendChild(
    card(
      "Publish portals",
      "Click a portal to jump to the platform page. In production: OAuth + API upload where available."
    )
  );

  const tiles = el("div", { className: "grid2" });
  tiles.appendChild(
    portalCard(
      "YouTube Studio",
      "Upload your video + audio. Auto-fill title/description/tags from the project.",
      "https://studio.youtube.com/"
    )
  );
  tiles.appendChild(
    portalCard(
      "Spotify for Artists",
      "Spotify requires a distributor for uploads; this links to the artist dashboard.",
      "https://artists.spotify.com/"
    )
  );
  tiles.appendChild(
    portalCard(
      "Apple Music for Artists",
      "Apple Music also requires a distributor for uploads; manage your artist profile here.",
      "https://artists.apple.com/"
    )
  );
  tiles.appendChild(
    portalCard(
      "Napster",
      "Napster typically receives music via distributors; this links you to the service.",
      "https://web.napster.com/"
    )
  );
  tiles.appendChild(
    portalCard(
      "SoundCloud Upload",
      "Fast track upload flow. (Direct API upload requires keys.)",
      "https://soundcloud.com/upload"
    )
  );
  tiles.appendChild(
    portalCard(
      "TikTok Creative Center",
      "Prepare a 15–60s highlight and upload with your caption.",
      "https://www.tiktok.com/creators/creator-portal/en-us/"
    )
  );
  wrap.appendChild(tiles);

  wrap.appendChild(
    card(
      "Distributor note",
      "Spotify/Apple/Napster usually require a distributor (DistroKid/TuneCore/UnitedMasters, etc.). DIETER’s Publish tab will package WAV + cover + lyrics + license PDF for upload."
    )
  );

  wrap.appendChild(
    card(
      "Share link",
      "In production: generate a shareable project page URL + private/public toggles."
    )
  );

  return wrap;
}

function renderDirector() {
  const wrap = el("div", { className: "routeMount" });

  wrap.appendChild(
    card(
      "AI Director (Agent)",
      "Your always-on agent for finishing songs: arrangement suggestions, mix checks, exports, and promo. Backend hooks plug into DIETER APIs."
    )
  );

  // --- SEO + Director controls (prototype) ---
  const seoCard = el("div", { className: "panel card" });
  seoCard.appendChild(el("h3", { className: "card__title", textContent: "SEO + Director (prototype)" }));
  seoCard.appendChild(
    el("p", { className: "card__muted", textContent: "Generate SEO ideas, save config, get a campaign plan, and track ROI (local JSON storage)." })
  );

  const API_BASE = "http://127.0.0.1:8787";
  const projectId = `proj_${hash(state.projectName || "untitled").toString(16)}`;
  let lastSeo = null;

  const btnRow = el("div", { className: "btnRow" });
  const btnSeo = el("button", { className: "btn btn--primary", type: "button", textContent: "Generate SEO suggestions" });
  const btnSaveCfg = el("button", { className: "btn", type: "button", textContent: "Save SEO config" });
  const btnPlan = el("button", { className: "btn btn--ghost", type: "button", textContent: "Ask Director plan" });
  btnRow.appendChild(btnSeo);
  btnRow.appendChild(btnSaveCfg);
  btnRow.appendChild(btnPlan);
  seoCard.appendChild(btnRow);

  const seoPre = el("pre", {
    className: "pre",
    dataset: { seoSuggestions: "true" },
    textContent: `Project: ${projectId}\n\nClick “Generate SEO suggestions”.`,
  });
  seoCard.appendChild(seoPre);

  const roiRow = el("div", { className: "grid2" });
  const sourceSel = el("select", { className: "input" });
  ["google", "spotify", "youtube", "tiktok-ad"].forEach((s) => sourceSel.appendChild(el("option", { value: s, textContent: s })));
  sourceSel.value = "spotify";

  const clicksInput = el("input", { className: "input", type: "number", value: "0", min: "0" });
  const playsInput = el("input", { className: "input", type: "number", value: "0", min: "0" });
  const revInput = el("input", { className: "input", type: "number", value: "0", step: "0.01", min: "0" });

  roiRow.appendChild(field("ROI source", sourceSel));
  const roiFields = el("div", { className: "field" });
  roiFields.appendChild(field("Clicks", clicksInput));
  roiFields.appendChild(field("Plays", playsInput));
  roiFields.appendChild(field("Revenue", revInput));
  roiRow.appendChild(roiFields);
  seoCard.appendChild(roiRow);

  const roiBtnRow = el("div", { className: "btnRow" });
  const btnRoi = el("button", { className: "btn", type: "button", textContent: "Save ROI" });
  roiBtnRow.appendChild(btnRoi);
  seoCard.appendChild(roiBtnRow);

  const directorPre = el("pre", {
    className: "pre",
    dataset: { directorPlan: "true" },
    textContent: "Director plan will appear here.",
  });
  seoCard.appendChild(directorPre);

  btnSeo.onclick = async () => {
    try {
      setStatus("Generating SEO suggestions…");
      const res = await fetch(`${API_BASE}/api/seo/suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.projectName || "Untitled",
          description: String($prompt.value || "").slice(0, 220),
          lyrics: state.lyrics || "",
          tags: [state.style, state.mood, state.language, state.vocalPreset, `${state.bpm}bpm`],
          genre: state.style,
        }),
      });
      const json = await res.json();
      lastSeo = json;
      seoPre.textContent = `Project: ${projectId}\n\n${JSON.stringify(json, null, 2)}`;
      setStatus("SEO suggestions generated.");
    } catch (e) {
      setStatus(`SEO failed: ${e?.message || String(e)}`);
    }
  };

  btnSaveCfg.onclick = async () => {
    try {
      if (!lastSeo?.keywords?.length) {
        setStatus("Generate SEO suggestions first.");
        return;
      }
      setStatus("Saving SEO config…");
      const res = await fetch(`${API_BASE}/api/seo/${encodeURIComponent(projectId)}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetKeywords: lastSeo.keywords,
          platforms: ["spotify", "youtube", "tiktok"],
          budgetPerMonth: 300,
        }),
      });
      await res.json();
      setStatus("SEO config saved.");
    } catch (e) {
      setStatus(`Save config failed: ${e?.message || String(e)}`);
    }
  };

  btnPlan.onclick = async () => {
    try {
      setStatus("Asking Director plan…");
      const res = await fetch(`${API_BASE}/api/director/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const json = await res.json();
      directorPre.textContent = JSON.stringify(json, null, 2);
      setStatus("Director plan ready.");
    } catch (e) {
      setStatus(`Director plan failed: ${e?.message || String(e)}`);
    }
  };

  btnRoi.onclick = async () => {
    try {
      setStatus("Saving ROI…");
      const res = await fetch(`${API_BASE}/api/seo/${encodeURIComponent(projectId)}/roi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: sourceSel.value,
          clicks: Number(clicksInput.value || 0),
          plays: Number(playsInput.value || 0),
          revenue: Number(revInput.value || 0),
        }),
      });
      await res.json();
      setStatus("ROI saved.");
    } catch (e) {
      setStatus(`ROI save failed: ${e?.message || String(e)}`);
    }
  };

  wrap.appendChild(seoCard);

  const row = el("div", { className: "grid2" });
  row.appendChild(
    card(
      "Release checklist",
      "WAV export • 44.1kHz • no clipping • hook by 0:30 (shorts) • cover art • lyrics • license"
    )
  );
  row.appendChild(
    card(
      "Distribution strategy",
      "Short preview → YouTube/TikTok • Full mix → distributor • Stems ZIP → collaborators • License PDF → monetization bundles."
    )
  );
  wrap.appendChild(row);

  wrap.appendChild(
    card(
      "Real vocals + lyric singing",
      "Real vocal/singing synthesis requires a server model (TTS/VC). DIETER will call `/api/vocals/apply` and receive a vocal stem + timing JSON."
    )
  );

  return wrap;
}

function portalCard(title, desc, url) {
  const c = el("div", { className: "panel card" });
  c.appendChild(el("h3", { className: "card__title", textContent: title }));
  c.appendChild(el("p", { className: "card__muted", textContent: desc }));
  c.appendChild(
    el("button", {
      className: "btn btn--primary",
      type: "button",
      textContent: "Open portal",
      onclick: () => {
        window.open(url, "_blank", "noopener,noreferrer");
        setStatus(`Opened: ${title}`);
      },
    })
  );
  return c;
}

function card(title, desc) {
  const c = el("div", { className: "panel card" });
  c.appendChild(el("h3", { className: "card__title", textContent: title }));
  c.appendChild(el("p", { className: "card__muted", textContent: desc }));
  return c;
}

function kpi(label, value) {
  return el("div", {
    className: "kpi",
    children: [
      el("div", { className: "kpi__label", textContent: label }),
      el("div", { className: "kpi__value", textContent: value }),
    ],
  });
}

function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;
  if (opts.textContent != null) node.textContent = opts.textContent;
  if (opts.type) node.type = opts.type;
  if (opts.placeholder) node.placeholder = opts.placeholder;
  if (opts.onclick) node.onclick = opts.onclick;
  if (opts.oninput) node.oninput = opts.oninput;
  if (opts.dataset) Object.assign(node.dataset, opts.dataset);
  if (opts.children) opts.children.forEach((ch) => node.appendChild(ch));
  return node;
}

function mustGetEl(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element: #${id}`);
  return el;
}

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(arr, seed) {
  return arr[Math.abs(seed) % arr.length];
}

function field(labelText, inputEl) {
  const wrap = el("div", { className: "field" });
  wrap.appendChild(el("div", { className: "label", textContent: labelText }));
  wrap.appendChild(inputEl);
  return wrap;
}

function wireWorkshop({
  canvas,
  fileInput,
  startInput,
  endInput,
  fadeInInput,
  fadeOutInput,
  btnPlay,
  btnStop,
  btnProcess,
  out,
}) {
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {AudioBuffer | null} */
  let buffer = null;
  /** @type {AudioBufferSourceNode | null} */
  let playing = null;

  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  const ensureCtx = () => (ctx ? ctx : (ctx = new (window.AudioContext || window.webkitAudioContext)()));

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    out.textContent = "Loading audio…";
    const ac = ensureCtx();
    const arr = await file.arrayBuffer();
    buffer = await ac.decodeAudioData(arr.slice(0));
    out.textContent = `Loaded: ${file.name} • ${fmt(buffer.duration)}s • ${buffer.sampleRate}Hz`;
    startInput.value = "0";
    endInput.value = String(Math.min(30, Math.max(1, Math.floor(buffer.duration))));
    drawWaveform(g, canvas, buffer);
  });

  btnPlay.addEventListener("click", async () => {
    if (!buffer) return (out.textContent = "Upload a song first.");
    const ac = ensureCtx();
    await ac.resume();
    stop();
    const start = clampNum(Number(startInput.value || 0), 0, buffer.duration);
    const end = clampNum(Number(endInput.value || buffer.duration), 0, buffer.duration);
    const dur = Math.max(0, end - start);
    if (dur <= 0.01) return (out.textContent = "Invalid range: end must be after start.");
    playing = ac.createBufferSource();
    playing.buffer = buffer;
    playing.connect(ac.destination);
    playing.start(0, start, dur);
    out.textContent = `Playing: ${fmt(start)}s → ${fmt(end)}s`;
    playing.onended = () => {
      playing = null;
    };
  });

  btnStop.addEventListener("click", stop);

  btnProcess.addEventListener("click", async () => {
    if (!buffer) return (out.textContent = "Upload a song first.");
    const start = clampNum(Number(startInput.value || 0), 0, buffer.duration);
    const end = clampNum(Number(endInput.value || buffer.duration), 0, buffer.duration);
    const fadeInS = clampNum(Number(fadeInInput.value || 0), 0, 60);
    const fadeOutS = clampNum(Number(fadeOutInput.value || 0), 0, 60);
    const dur = Math.max(0, end - start);
    if (dur <= 0.01) return (out.textContent = "Invalid range: end must be after start.");

    out.textContent = "Processing…";
    stop();
    const processed = trimBuffer(buffer, start, end);
    applyFades(processed, fadeInS, fadeOutS);
    drawWaveform(g, canvas, processed);
    const wav = audioBufferToWavBlob(processed);
    const name = `dieter-edit-${Math.round(dur)}s.wav`;
    downloadBlob(wav, name);
    out.textContent = `Exported: ${name}`;
  });

  function stop() {
    if (playing) {
      try {
        playing.stop();
      } catch {}
      playing = null;
    }
  }
}

function wireVideoSync({
  canvas,
  fileInput,
  bpmInput,
  durInput,
  btnPreview,
  btnRecord,
  btnStop,
  downloadWrap,
}) {
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {AudioBuffer | null} */
  let buffer = null;
  /** @type {AudioBufferSourceNode | null} */
  let source = null;
  /** @type {MediaRecorder | null} */
  let recorder = null;
  /** @type {BlobPart[]} */
  let chunks = [];
  let raf = 0;
  let startedAt = 0;
  let bpm = 128;
  let durationS = 15;

  const g = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
  const ensureCtx = () => (ctx ? ctx : (ctx = new (window.AudioContext || window.webkitAudioContext)()));

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    downloadWrap.textContent = "Loading audio…";
    const ac = ensureCtx();
    const arr = await file.arrayBuffer();
    buffer = await ac.decodeAudioData(arr.slice(0));
    downloadWrap.textContent = `Loaded: ${file.name} • ${fmt(buffer.duration)}s`;
    drawVideoFrame(g, canvas, 0, 0, bpm);
  });

  btnPreview.addEventListener("click", async () => {
    if (!buffer) return (downloadWrap.textContent = "Upload a song first.");
    bpm = clampNum(Number(bpmInput.value || 128), 40, 240);
    durationS = clampNum(Number(durInput.value || 15), 3, 600);
    const ac = ensureCtx();
    await ac.resume();
    stopAll();
    playAudio(ac, buffer, Math.min(durationS, buffer.duration));
    startVisualLoop(ac);
    downloadWrap.textContent = `Previewing: ${durationS}s @ ${bpm} BPM`;
  });

  btnRecord.addEventListener("click", async () => {
    if (!buffer) return (downloadWrap.textContent = "Upload a song first.");
    bpm = clampNum(Number(bpmInput.value || 128), 40, 240);
    durationS = clampNum(Number(durInput.value || 15), 3, 600);
    const ac = ensureCtx();
    await ac.resume();
    stopAll();

    const canvasStream = canvas.captureStream(30);
    const mediaDest = ac.createMediaStreamDestination();

    source = ac.createBufferSource();
    source.buffer = buffer;
    source.connect(ac.destination);
    source.connect(mediaDest);

    const mixedStream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...mediaDest.stream.getAudioTracks(),
    ]);

    const mime = pickFirstSupported([
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ]);

    recorder = new MediaRecorder(mixedStream, mime ? { mimeType: mime } : undefined);
    chunks = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: recorder?.mimeType || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dieter-synced-${durationS}s-${bpm}bpm.webm`;
      a.textContent = `Download video: ${a.download}`;
      a.className = "btn btn--primary";
      downloadWrap.innerHTML = "";
      downloadWrap.appendChild(a);
      setStatus("Video recorded. Download ready.");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };

    recorder.start();
    startedAt = ac.currentTime;
    source.start(0, 0, Math.min(durationS, buffer.duration));
    startVisualLoop(ac);
    downloadWrap.textContent = `Recording… ${durationS}s @ ${bpm} BPM`;

    setTimeout(() => {
      if (recorder && recorder.state === "recording") recorder.stop();
      stopAudioOnly();
      stopVisualOnly();
    }, durationS * 1000 + 150);
  });

  btnStop.addEventListener("click", stopAll);

  function playAudio(ac, buf, dur) {
    source = ac.createBufferSource();
    source.buffer = buf;
    source.connect(ac.destination);
    startedAt = ac.currentTime;
    source.start(0, 0, dur);
    source.onended = () => {
      source = null;
    };
  }

  function startVisualLoop(ac) {
    cancelAnimationFrame(raf);
    const tick = () => {
      const t = ac.currentTime - startedAt;
      drawVideoFrame(g, canvas, t, durationS, bpm);
      raf = requestAnimationFrame(tick);
    };
    tick();
  }

  function stopAudioOnly() {
    if (source) {
      try {
        source.stop();
      } catch {}
      source = null;
    }
  }

  function stopVisualOnly() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function stopAll() {
    stopAudioOnly();
    stopVisualOnly();
    if (recorder && recorder.state === "recording") {
      try {
        recorder.stop();
      } catch {}
    }
    recorder = null;
    downloadWrap.textContent = "Stopped.";
  }
}

function drawVideoFrame(g, canvas, t, dur, bpm) {
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);

  const bps = bpm / 60;
  const phase = (t * bps) % 1;
  const pulse = Math.exp(-phase * 6);

  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `rgba(10, 12, 22, 1)`);
  grad.addColorStop(1, `rgba(3, 8, 16, 1)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  g.globalAlpha = 0.25;
  for (let i = 0; i < 120; i++) {
    const x = (i * 97) % w;
    const y = (i * 191) % h;
    const r = 0.8 + ((i % 7) / 7) * 1.6;
    g.fillStyle = `rgba(255,255,255,${0.12 + pulse * 0.25})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;

  const cx = w * 0.5;
  const cy = h * 0.52;
  const base = Math.min(w, h) * 0.18;
  const ring = base + pulse * base * 0.6;
  g.lineWidth = 10;
  g.strokeStyle = `rgba(63,210,255,${0.25 + pulse * 0.65})`;
  g.beginPath();
  g.arc(cx, cy, ring, 0, Math.PI * 2);
  g.stroke();

  g.lineWidth = 3;
  g.strokeStyle = `rgba(255,140,30,${0.18 + pulse * 0.6})`;
  g.beginPath();
  for (let x = 0; x < w; x += 6) {
    const yy = cy + Math.sin(x * 0.012 + t * 4) * (28 + pulse * 36) * Math.sin(t * 0.8);
    if (x === 0) g.moveTo(x, yy);
    else g.lineTo(x, yy);
  }
  g.stroke();

  g.fillStyle = "rgba(234,240,255,0.92)";
  g.font = "700 34px Inter, system-ui, sans-serif";
  g.fillText("DIETER // SYNC", 44, 74);
  g.font = "600 18px Inter, system-ui, sans-serif";
  g.fillStyle = "rgba(234,240,255,0.68)";
  g.fillText(`${Math.round(bpm)} BPM • ${fmt(t)}s`, 44, 106);

  if (dur > 0) {
    const p = Math.min(1, t / dur);
    g.fillStyle = "rgba(255,255,255,0.12)";
    g.fillRect(44, h - 70, w - 88, 10);
    g.fillStyle = "rgba(63,210,255,0.7)";
    g.fillRect(44, h - 70, (w - 88) * p, 10);
  }
}

function drawWaveform(g, canvas, buffer) {
  const w = canvas.width;
  const h = canvas.height;
  g.clearRect(0, 0, w, h);

  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(0, 0, w, h);

  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / w);
  const amp = h * 0.42;

  g.strokeStyle = "rgba(63,210,255,0.8)";
  g.lineWidth = 2;
  g.beginPath();
  for (let x = 0; x < w; x++) {
    let min = 1;
    let max = -1;
    const start = x * step;
    const end = Math.min(start + step, data.length);
    for (let i = start; i < end; i++) {
      const v = data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const y1 = h / 2 + min * amp;
    const y2 = h / 2 + max * amp;
    g.moveTo(x, y1);
    g.lineTo(x, y2);
  }
  g.stroke();

  g.fillStyle = "rgba(234,240,255,0.7)";
  g.font = "600 14px Inter, system-ui, sans-serif";
  g.fillText(`Waveform • ${fmt(buffer.duration)}s`, 16, 24);
}

function trimBuffer(buffer, startSec, endSec) {
  const sr = buffer.sampleRate;
  const start = Math.floor(startSec * sr);
  const end = Math.floor(endSec * sr);
  const len = Math.max(1, end - start);
  const out = new AudioBuffer({
    length: len,
    numberOfChannels: buffer.numberOfChannels,
    sampleRate: sr,
  });
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = out.getChannelData(ch);
    dst.set(src.subarray(start, start + len));
  }
  return out;
}

function applyFades(buffer, fadeInSec, fadeOutSec) {
  const sr = buffer.sampleRate;
  const fadeIn = Math.floor(fadeInSec * sr);
  const fadeOut = Math.floor(fadeOutSec * sr);
  const len = buffer.length;

  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      let m = 1;
      if (fadeIn > 0 && i < fadeIn) m *= i / fadeIn;
      if (fadeOut > 0 && i > len - fadeOut) m *= (len - i) / fadeOut;
      data[i] *= m;
    }
  }
}

function audioBufferToWavBlob(buffer) {
  const numCh = buffer.numberOfChannels;
  const sr = buffer.sampleRate;
  const len = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const byteRate = sr * blockAlign;
  const dataSize = len * blockAlign;

  const ab = new ArrayBuffer(44 + dataSize);
  const dv = new DataView(ab);
  let o = 0;

  writeStr(dv, o, "RIFF");
  o += 4;
  dv.setUint32(o, 36 + dataSize, true);
  o += 4;
  writeStr(dv, o, "WAVE");
  o += 4;
  writeStr(dv, o, "fmt ");
  o += 4;
  dv.setUint32(o, 16, true);
  o += 4;
  dv.setUint16(o, 1, true);
  o += 2;
  dv.setUint16(o, numCh, true);
  o += 2;
  dv.setUint32(o, sr, true);
  o += 4;
  dv.setUint32(o, byteRate, true);
  o += 4;
  dv.setUint16(o, blockAlign, true);
  o += 2;
  dv.setUint16(o, 16, true);
  o += 2;
  writeStr(dv, o, "data");
  o += 4;
  dv.setUint32(o, dataSize, true);
  o += 4;

  const chans = [];
  for (let ch = 0; ch < numCh; ch++) chans.push(buffer.getChannelData(ch));

  let idx = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = clamp(chans[ch][i], -1, 1);
      dv.setInt16(idx, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      idx += 2;
    }
  }

  return new Blob([ab], { type: "audio/wav" });
}

function writeStr(dv, offset, s) {
  for (let i = 0; i < s.length; i++) dv.setUint8(offset + i, s.charCodeAt(i));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

function clampNum(v, min, max) {
  if (!Number.isFinite(v)) return min;
  return Math.min(max, Math.max(min, v));
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function fmt(sec) {
  return `${sec.toFixed(1)}`;
}

function pickFirstSupported(mimes) {
  if (!("MediaRecorder" in window)) return "";
  for (const m of mimes) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

# Dieter / ED-GEERDES — web audio stack reference

Curated map of **browser-native** music tech that pairs with the Vite app, static platform page, and FastAPI backends. Use this alongside **[WAM_ECOSYSTEM.md](./WAM_ECOSYSTEM.md)** (WAM hosts) and **[DIETER_MUSIC_APP.md](./DIETER_MUSIC_APP.md)** (deploy).

## Top repos (starting points)

| Project | Role | Link |
| -------- | ----- | ---- |
| **Tone.js** | High-level scheduling, instruments, FX | [Tonejs/Tone.js](https://github.com/Tonejs/Tone.js) |
| **Web Audio Modules** | Plugin ABI + SDK (`@webaudiomodules/sdk`) | [webaudiomodules](https://github.com/webaudiomodules) |
| **openDAW** | Full web DAW (TS, AGPL) | [andremichelle/openDAW](https://github.com/andremichelle/openDAW) |
| **WebDAW** | React + WAM-oriented web DAW experiment | [ai-music/webdaw](https://github.com/ai-music/webdaw) |
| **Sona AI DAW** | AI-assisted fork path (openDAW lineage) | [suislanchez/Sona-AI-DAW](https://github.com/suislanchez/Sona-AI-DAW) |
| **Awesome WebAudio** | Index of libraries | [notthetup/awesome-webaudio](https://github.com/notthetup/awesome-webaudio) |
| **Magenta.js** | ML in browser (limited vs Python stack) | [magenta/magenta-js](https://github.com/magenta/magenta-js) |

Star counts drift; treat tables as **entry points**, not rankings.

## Web-native synths and UI-heavy projects

| Name | Notes | License | GitHub |
|------|--------|---------|--------|
| **Surge XT** | Real Surge is a large C++ / JUCE project; **in-browser** use is usually via native builds, ports, or future WASM — not a five-line `Oscillator` | GPL-3.0 | [surge-synthesizer/surge](https://github.com/surge-synthesizer/surge) |
| **SynthJS** | Small Web Audio helpers | MIT | [mattdiamond/synthjs](https://github.com/mattdiamond/synthjs) |
| **WebAudioSynth V2** | Analog-style UI | MIT | [aike/webaudiosynthv2](https://github.com/aike/webaudiosynthv2) |
| **web-synth** | Deeper stack (Faust / SOUL-related tooling in repo history) | MIT | [Ameobea/web-synth](https://github.com/Ameobea/web-synth) |
| **Helm** | Classic open synth (desktop); web reuse ≠ drop-in class | GPL-3.0 | [mtytel/helm](https://github.com/mtytel/helm) |

Commercial clones (Dexed, OB-Xd, TAL, Vital, etc.) are **mostly desktop plugins**. Anything “web port” should be verified per-repo (WASM, JUCE WebView, or third-party experiment).

## DSP engines and native plugin stacks (expect integration work)

| Name | Reality check | License | Link |
|------|----------------|---------|------|
| **LSP Plugins** | Professional LV2/VST — **not** an `npm install` away in the browser; needs WASM / bridge work | LGPL | [lsp-plugins/lsp-plugins](https://github.com/lsp-plugins/lsp-plugins) |
| **DISTRHO Ports** | Native plugins — same caveat for the web | GPL | [DISTRHO/DISTRHO-Ports](https://github.com/DISTRHO/DISTRHO-Ports) |
| **Faust** | Faust → WASM / Worklet via Faust toolchain (`faust2wasm`, Faust Playground, `faustwasm`, etc.) | GPL / MIT tooling | [Grame-CNCM/faust](https://github.com/Grame-CNCM/faust) |
| **SOUL** | Language + runtime (browser story is non-trivial) | Apache-style | [Soul language / tooling repos](https://github.com/soul-lang) |

For Dieter, the **practical** path is: **Tone.js** and/or **WAM SDK** on the client, **FFmpeg / custom DSP** on the server where latency allows.

## Effects collections and meta-lists

| Resource | Link |
|----------|------|
| IRCAM forum / software (institutional) | Search [IRCAM](https://www.ircam.fr/) current distribution pages |
| OpenAudio (WebProfusion) | [openaudio.webprofusion.com](https://openaudio.webprofusion.com/) |
| Awesome WebAudio | [notthetup/awesome-webaudio](https://github.com/notthetup/awesome-webaudio) |

## Copy-paste patterns (corrected)

### 1. One-shot saw (not “Surge XT” — teaching snippet only)

A single `Oscillator` cannot be reused after `stop()` for overlapping notes; spawn a **new** oscillator per note.

```javascript
function playSawNote(audioContext, freq, durationSec) {
  const ctx = audioContext;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(ctx.destination);
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + durationSec);
  osc.start(t);
  osc.stop(t + durationSec + 0.05);
}
```

### 2. Dynamics compressor (requires `connect`)

```javascript
class WebDynamicsCompressor {
  constructor(audioContext, ratio = 4, threshold = -24) {
    this.node = audioContext.createDynamicsCompressor();
    this.node.ratio.value = ratio;
    this.node.threshold.value = threshold;
    this.node.knee.value = 30;
    this.node.attack.value = 0.003;
    this.node.release.value = 0.25;
  }
  connect(source, destination) {
    source.connect(this.node);
    this.node.connect(destination);
  }
}
```

### 3. Faust in the browser

There is **no** universal `FaustCompiler.compile()` one-liner in production pages. Typical flows: **Faust Playground**, **faust2wasm** CLI, or **@grame/faustwasm** (see current Grame docs). Wire the resulting `AudioWorklet` or `ScriptProcessorNode` replacement into your graph.

## npm / packages (verify before relying on READMEs)

| Package | Use |
|---------|-----|
| `tone` | Stable choice for orchestration |
| `@webaudiomodules/sdk` | WAM host bootstrap |
| Faust | Use **official** Grame packages / wasm artifacts for your bundler |
| `soundpipe-js` | Exists in various forks; evaluate bundle size and maintenance |

Treat **`lsp-plugins-wasm`**-style names as **aspirational** unless you pin a maintained repository.

## UI rack stub (HTML)

The static showroom **`mureka-clone/public/ed-geerdes-platform.html`** includes a **Plugin rack (web demos)** section: saw note, compressor burst, and toggles that reuse **Convolver reverb** and **Delay line**. Labels are intentionally honest (stubs, not Dexed/Surge binaries).

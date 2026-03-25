# Web Audio Modules (WAM) — ecosystem reference

Short map of hosts and projects that pair well with **ED-GEERDES** when you want **in-browser** synths, FX, pedalboards, or a **multi-track WAM DAW**. Official org: **[github.com/webaudiomodules](https://github.com/webaudiomodules)** · site **[webaudiomodules.org](https://webaudiomodules.org)**.

| Plugin / platform       | Type              | Features                                      | GitHub / links |
| ------------------------- | ----------------- | --------------------------------------------- | -------------- |
| **WAM Community**         | 40+ plugins index | Synths, FX, MIDI-oriented WAMs                | [boourns/wam-community](https://github.com/boourns/wam-community) · [webaudiomodules.com/community](https://www.webaudiomodules.com/community) · [plugins.json index](https://www.webaudiomodules.com/community/plugins.json) |
| **Guitar Pedalboard**     | WAM2 FX host      | Distortion, reverb, delay chains, drag/order  | [QuentinBeauchet/PedalBoard](https://github.com/QuentinBeauchet/PedalBoard) (related upstream: [michael-marynowicz/TER](https://github.com/michael-marynowicz/TER)) |
| **Open Studio DAW**       | Full DAW          | Multitrack + WAM plugins (Wasm/audio thread) | [TER-M1/wam-openstudio](https://github.com/TER-M1/wam-openstudio) · demo [wam-openstudio.dylann.fr](https://wam-openstudio.dylann.fr/) |
| **Sequencer Party**       | Collaborative live| Many WAM2 modules, real-time sessions        | [sequencer.party](https://sequencer.party/) |

## Also useful

- **WAM API (spec):** [webaudiomodules/api](https://github.com/webaudiomodules/api)  
- **WAM SDK:** [webaudiomodules/sdk](https://github.com/webaudiomodules/sdk)  
- **Examples:** [webaudiomodules/wam-examples](https://github.com/webaudiomodules/wam-examples)  

## ED-GEERDES integration notes

- Host WAM **inside** `ed-geerdes-platform.html` or the main Vite app by loading the **WAM SDK** + a **processor URL** from the community index (iframe or same-origin AudioWorklet, depending on hosting).
- **Payments / stems** can stay on your **FastAPI** (`/api/upload`, `/api/mix/suno-mureka/render`, etc.); WAM is the **front-end audio graph**.
- Search **YouTube** for *Web Audio Modules*, *wam-openstudio*, or *wam pedalboard* for walkthroughs — URLs change; not pinned here.

See also **[DIETER_MUSIC_APP.md](./DIETER_MUSIC_APP.md)** (deploy, domain, Stripe).

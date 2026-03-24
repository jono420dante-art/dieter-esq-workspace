# Release journey (Beat Lab Pro)

End-to-end story vs. what this repo actually automates.

## The five steps

1. **Type lyrics → drag beat**  
   **UI:** Beat Lab → **AI Music Studio — local pipeline** — lyrics textarea + beat file.  
   **API:** `POST /api/pipeline/generate-master` (`beat` + `lyrics` multipart).

2. **“Generating…” → pro mastered track**  
   **Behavior:** Procedural vocal → FFmpeg mix → **`pro_master_audio`** (trim **≤ ~3 min**, fade in/out, **EBU R128-style loudnorm** ~−14 LUFS, MP3 320k).  
   **UI:** Button shows **Generating…** while the request runs.

3. **“Upload to Spotify / Apple Music” → DistroKid metadata**  
   **Automated here:** JSON **`metadata`** in the API response (title, artist, platforms note, ISRC placeholder) + optional **`POST /api/pipeline/upload-distrokid-prep`** (saves MP3 + sidecar JSON under `storage/distro_prep/`).  
   **Not automated:** DistroKid has **no public upload API** — you still **open [distrokid.com](https://distrokid.com)** and paste fields / upload the file in their UI. See `dieter-backend/DISTROKID_RELEASE.md`.

4. **Beat-synced music video**  
   **Automated (optional):** After a successful master, **`POST /api/local/music-video`** can run with **librosa beat detection** on the master + FFmpeg **showwaves** + beat flashes (requires **ffmpeg** on the server). Toggle **Auto-generate beat-synced video** in Beat Lab Pro.  
   **Not:** HeyGen / MAIVE–style generative video — that would be a separate provider integration.

5. **Track live on 100+ platforms in ~5 days**  
   **Reality:** Distributor **UI** (e.g. DistroKid) lists many stores; **go-live dates** vary by store and release settings. **~5 days** is a common *planning* guideline, not a guarantee — confirm in your aggregator and each store’s status.

---

## Quick API reference

| Step | Route |
|------|--------|
| Master pipeline | `POST /api/pipeline/generate-master` |
| Distro prep (files on disk) | `POST /api/pipeline/upload-distrokid-prep` |
| Waveform / beat-flash video | `POST /api/local/music-video` |

Same-origin in production Docker; dev: Vite proxies `/api` → FastAPI (e.g. `8787`).

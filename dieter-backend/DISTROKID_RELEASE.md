# After mastering: DistroKid (manual upload)

The DIETER API does **not** call DistroKid—there is no public REST upload. Use the dashboard in your browser.

**Full 5-step product story vs. reality:** see **`RELEASE_JOURNEY.md`** in the repository root.

**From this repo:**

- `POST /api/pipeline/generate-master` — returns `metadata` plus `masterUrl` (download the mastered MP3).
- `POST /api/pipeline/upload-distrokid-prep` — optional: saves your file + `metadata_json` under `storage/distro_prep/` for your own bookkeeping.

---

## Typical release flow

1. **[distrokid.com](https://distrokid.com)** — Sign up (Musician plan is commonly advertised as **unlimited uploads** for a yearly fee; **check current pricing** on their site.)
2. **Upload** your mastered track (e.g. `mastered.mp3`) — **Copy title, artist, and other fields** from the API `metadata` response (or your own sidecar JSON).
3. **Select stores** — e.g. Spotify, Apple Music, Napster, and many others (exact list is in their UI).
4. **Release date** — Choose a date (e.g. **~5 days** lead time is common for first-time distribution; **stores set their own go-live timing**—confirm in DistroKid when you schedule.)

---

## Notes

- **ISRC** must be assigned through your label, aggregator, or DistroKid’s flow—do not invent fake ISRCs for production.
- **Timeline** “live everywhere” depends on each store’s ingestion; use DistroKid’s status pages for your release.

# iCloud Drive vs Dieter storage

## What a browser can and cannot do

- **Cannot:** Mount or route **iCloud Drive** as a folder for a normal website. Dieter (Vite/React) and your Railway server cannot read files directly from **your** Apple ID iCloud quota.
- **Can:** Use the **system file picker**. On **Mac, iPhone, and iPad**, that dialog includes **iCloud Drive** in the sidebar — users pick a file there like any other location.
- **Can:** **Download** audio from Dieter and move it to iCloud in **Finder** or **Files**.

## Sorted server storage (Dieter API)

Uploads and pipeline outputs live on the FastAPI host under `storage/uploads`, `storage/local`, and `storage/voice_clone`.

**API:** `GET /api/studio/storage?bucket=all|uploads|local|voice_clone&sort=mtime|name|size&order=asc|desc`

The **Local** tab in the React app shows this list when the API is healthy. It lists **server** files, not your personal iCloud library.

## Deploy notes

- **Single Docker URL:** same-origin `/api/...` — no extra env for storage routes.
- **Vercel + API:** set `VITE_API_BASE` to `https://your-api/.../api` and allow CORS from the UI origin on FastAPI.

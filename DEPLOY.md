# Deploy DIETER (Option A: Vercel + Render)

Deploy the **SPA** from `dieter-platform/` (modular app with `js/`, `css/`).  
The `deploy/` folder and `dieter-pro-full-studio.html` are **legacy single-file demos** — use **`dieter-platform`** for production.

---

## 1. Backend API + tRPC (Render)

1. Push this folder to **GitHub** (or GitLab/Bitbucket Render supports).
2. In [Render](https://render.com) → **New** → **Blueprint**.
3. Connect the repo and select **`dieter-backend/render.yaml`**.
4. Deploy both services (`dieter-api`, `dieter-trpc`).
5. After deploy, open your **FastAPI** URL (e.g. `https://dieter-api.onrender.com`) and confirm **`GET /api/health`** works.
6. On the **tRPC** service, set **`DIETER_FASTAPI_BASE`** to your real API URL (no trailing slash), e.g.  
   `https://dieter-api.onrender.com`  
   Redeploy tRPC if you changed it.

**CORS:** If the browser blocks calls from your Vercel domain, add your frontend origin to the FastAPI CORS allowlist in `dieter-backend` (see `app/main.py` or CORS middleware).

---

## 2. Frontend (Vercel)

### Dashboard

1. [Vercel](https://vercel.com) → **Add New** → **Project** → import the same repo.
2. **Root Directory:** `dieter-platform`
3. **Framework Preset:** Other (or “Vite” is fine; there is no real build).
4. **Build Command:** `npm run build` (no-op script in `package.json`)
5. **Output Directory:** `.` (project root for static files)
6. Deploy.

`vercel.json` already rewrites client-side routes to `index.html` without breaking `*.js` / `*.css`.

### CLI (optional)

```powershell
cd "path\to\dIETER JONO TOWEER_files\dieter-platform"
npm install
npx vercel login
npx vercel        # preview
npx vercel --prod # production
```

---

## 3. Wire the UI to the API

The app reads the backend URL from **localStorage** key `dp-backend-base` (Create page: “Backend base URL”).

After first load on Vercel, users should enter your Render API base, e.g.:

`https://dieter-api.onrender.com`

Then enable **Use DIETER Backend API** on the Create page.

**MacBook Air / second device:** In DIETER open **Mureka** → **Mac / deployment** (sidebar), paste your **Vercel** URL and **Render** API URL → **Save links & set API base**. Details: **`MAC_SETUP.md`**.

---

## 4. Checklist

| Step | Check |
|------|--------|
| Render `dieter-api` | `/api/health` returns 200 |
| Render `dieter-trpc` | `/health` returns 200 |
| Vercel site | Loads `index.html`, CSS/JS 200 |
| Create page | Backend URL saved + “Use DIETER Backend API” generates jobs |

---

## 5. Troubleshooting

- **404 on refresh** (e.g. `/create`): Root Directory must be `dieter-platform` and `vercel.json` rewrites must be present.
- **CORS errors**: Allow your `*.vercel.app` domain on the FastAPI server.
- **Mixed content**: Frontend HTTPS must call backend **HTTPS** URLs only.

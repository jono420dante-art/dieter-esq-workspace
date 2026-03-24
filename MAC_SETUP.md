# Use DIETER on your MacBook Air

Set these once; they’re also saved inside the app (**Mureka** page → **Mac / deployment**).

## 1. Deploy URLs (replace with yours)

| What | Example | Where to use |
|------|---------|----------------|
| **Frontend (Vercel)** | `https://YOUR-PROJECT.vercel.app` | Safari bookmark, home screen |
| **Backend API (Render)** | `https://dieter-api.onrender.com` | Same panel → **Save links & set API base** |

After deploy, open the **frontend URL** on the Mac, go to **Mureka** → **Mac / deployment**, paste both URLs → **Save links & set API base**.

## 2. Create Music (API)

1. Open **Create Music**.
2. Turn on **Use DIETER Backend API**.
3. **Backend base URL** should match your Render service (no trailing slash), e.g.  
   `https://dieter-api.onrender.com`
4. If the field is empty, the same value you saved from the Mureka panel is used (`localStorage` key `dp-backend-base`).

## 3. Optional: Mureka API key

For **Create on Mureka.ai** from the embedded suite, use your key from [platform.mureka.ai](https://platform.mureka.ai) (stored in the React app; DIETER platform uses Mureka via your backend proxy when configured).

## 4. Quick copy

```
Frontend:  https://YOUR-APP.vercel.app
Backend:   https://YOUR-API.onrender.com
```

Replace `YOUR-*` with your real hostnames after deployment.

# Windows — run Local Studio + UI

## Easiest: double‑click

1. In File Explorer go to:  
   `Downloads\dIETER JONO TOWEER_files\`  
   (or wherever this project folder is)

2. **Double‑click `OPEN-DIETER-LOCAL.bat`**

3. Wait — two black **Command Prompt** windows should open (API + Vite), and your browser should open.

4. On the website click **Local** → **Ping local API**.

If nothing opens: right‑click `OPEN-DIETER-LOCAL.bat` → **Run as administrator** (only if your folder is blocked).

---

## Why you saw errors

- `.\run-local-studio.ps1` only works if you **first `cd`** into the folder that contains it.
- Your project is **not** `C:\Users\Michelle\dieter-local-studio`.  
  It is under **Downloads**, e.g.:

`C:\Users\Michelle\Downloads\dIETER JONO TOWEER_files\`

## Option A — launcher scripts (easiest)

1. Open **PowerShell** (not Python — do not type these in the `>>>` Python prompt).

2. **Terminal 1 — Local API (port 8890)**

```powershell
cd "C:\Users\Michelle\Downloads\dIETER JONO TOWEER_files"
.\START-LOCAL-API.ps1
```

3. **Terminal 2 — React UI**

```powershell
cd "C:\Users\Michelle\Downloads\dIETER JONO TOWEER_files"
.\START-MUREKA-UI.ps1
```

4. Browser: **http://localhost:5173** → use the **Local** tab → **Ping local API**.

## Option B — manual commands

**API:**

```powershell
cd "C:\Users\Michelle\Downloads\dIETER JONO TOWEER_files\dieter-local-studio"
.\run-local-studio.ps1
```

**UI:**

```powershell
cd "C:\Users\Michelle\Downloads\dIETER JONO TOWEER_files\mureka-clone"
npm install
npm run dev
```

## If your folder name is different

Search File Explorer for `run-local-studio.ps1`, open its folder, then use that path in `cd "..."`.

## If scripts are “blocked”

In PowerShell (once):

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## Never use these in the Python REPL

If you see `>>>` you are inside **Python**. Type `exit()` to leave, then run PowerShell commands again.

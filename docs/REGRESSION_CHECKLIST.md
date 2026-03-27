# Pre-release regression checklist

Use before shipping backend, tRPC, Cloudflare `functions/api` proxy, or static frontends (mureka-clone, dieter-platform).

## Health and routing

1. `GET /api/health` returns `ok: true` on the FastAPI host you deploy.
2. From the browser origin you use in production, `GET /api/tealvoices/status` succeeds (or fails with a clear CORS/base-URL message you expect).
3. If the UI uses tRPC, `GET` or `POST` to `/trpc/health` (or your mounted path) reaches the Node server and FastAPI health via proxy.

## Lyrics

4. `POST /api/lyrics/generate` with `{ "style": "pop", "title": "Test", "vocal": "female" }` returns `text` and `source` (`openai`, `anthropic`, or `local`). When keys are missing or providers error, `warnings` may list fallbacks (see server logs for details).
5. `POST /api/lyrics/optimize` with real lyric lines returns improved `text`. Whitespace-only body must return **422** validation error.
6. `POST /api/lyrics/analyze` accepts the same lyric blob your Create tab sends (if you use analyze in the UI).

## Music jobs (local engine)

7. `POST /api/music/plan` then `POST /api/music/generate`, poll `GET /api/jobs/{id}` until `succeeded` or terminal failure.
8. Confirm exported `wavUrl` paths resolve when prefixed with your public API origin (Vercel proxy or absolute backend URL).

## Mureka (if enabled)

9. `POST /api/mureka/song/generate` with a valid Bearer token returns a task id; `GET /api/mureka/song/query/{taskId}` progresses to a finished state or clear error. Wrong token must surface **401** through tRPC as `UNAUTHORIZED`, not a generic bad request.

## Teal / vocal WAV

10. `POST /api/tealvoices/sing` with sample lyrics returns `url` or a structured error; the **dieter-platform** Lyrics page can download and play the WAV via `absoluteStorageUrl`.

## Frontends

11. **dieter-platform** Lyrics: **AI draft** / **Polish** hit `/api/lyrics/generate|optimize` using `dp-backend-base`, `dp-openai-key`, and optional `dp-anthropic-key`.
12. **mureka-clone** Create flow: generate → optional Mureka → playback URLs still work with your `VITE_API_BASE` / proxy settings.

## Environment sanity

13. `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `MUREKA_API_KEY` (or per-request keys) match what you document for operators.
14. Cloudflare Pages **DIETER_API_ORIGIN** (or equivalent) points at the live FastAPI base with **no** trailing slash issues.

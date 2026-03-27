import cors from "cors";
import express from "express";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

const FASTAPI_BASE = process.env.DIETER_FASTAPI_BASE ?? "http://127.0.0.1:8787";
const PORT = Number(process.env.DIETER_TRPC_PORT ?? 8790);
/** Optional: public browser-facing API origin (e.g. https://studio.example.com) for absolute WAV URLs */
const DEFAULT_PUBLIC_ORIGIN = (process.env.DIETER_PUBLIC_API_ORIGIN ?? "").trim().replace(/\/$/, "");

const t = initTRPC.create();

async function fastapiJson(path: string, init?: RequestInit): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${FASTAPI_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `FastAPI unreachable (${url}): ${msg}`,
    });
  }
  const text = await res.text();
  if (!res.ok) {
    let detail = text?.trim() || `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { detail?: unknown };
      if (j?.detail != null) {
        detail = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
      }
    } catch {
      /* keep raw text */
    }
    let code: "INTERNAL_SERVER_ERROR" | "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "UNPROCESSABLE_CONTENT" | "TOO_MANY_REQUESTS" =
      "BAD_REQUEST";
    if (res.status === 401) code = "UNAUTHORIZED";
    else if (res.status === 403) code = "FORBIDDEN";
    else if (res.status === 404) code = "NOT_FOUND";
    else if (res.status === 422) code = "UNPROCESSABLE_CONTENT";
    else if (res.status === 429) code = "TOO_MANY_REQUESTS";
    else if (res.status >= 500) code = "INTERNAL_SERVER_ERROR";

    throw new TRPCError({
      code,
      message: detail.slice(0, 2000),
    });
  }
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `FastAPI returned non-JSON (${url}): ${text.slice(0, 240)}`,
    });
  }
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}

/** Turn `/api/storage/...` into absolute URLs for browser playback when UI and API differ by path-only same host, or cross-host. */
function resolveWavUrlsInOutput(
  output: unknown,
  publicOrigin: string
): unknown {
  if (!output || typeof output !== "object") return output;
  const origin = stripTrailingSlash(publicOrigin);
  const abs = (u: unknown): unknown => {
    if (typeof u !== "string") return u;
    if (/^https?:\/\//i.test(u)) return u;
    if (!u.startsWith("/")) return u;
    return `${origin}${u}`;
  };
  const deep = JSON.parse(JSON.stringify(output)) as Record<string, unknown>;
  const mix = deep.mix;
  if (mix && typeof mix === "object") {
    const m = mix as Record<string, unknown>;
    if (typeof m.wavUrl === "string") {
      m.wavUrlAbsolute = abs(m.wavUrl);
    }
  }
  if (Array.isArray(deep.stems)) {
    for (const s of deep.stems) {
      if (s && typeof s === "object" && typeof (s as Record<string, unknown>).wavUrl === "string") {
        const st = s as Record<string, unknown>;
        st.wavUrlAbsolute = abs(st.wavUrl);
      }
    }
  }
  return deep;
}

const appRouter = t.router({
  health: t.procedure.query(async () => {
    const data = (await fastapiJson("/api/health")) as { ok?: boolean; time?: number };
    if (!data || data.ok !== true) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "FastAPI health response invalid" });
    }
    return data as { ok: boolean; time: number };
  }),

  musicPlan: t.procedure
    .input(
      z.object({
        prompt: z.string().min(1),
        lyrics: z.string().optional(),
        bpm: z.number().int().min(40).max(240),
        mood: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return fastapiJson("/api/music/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
    }),

  musicGenerate: t.procedure
    .input(
      z.object({
        prompt: z.string().min(1),
        lyrics: z.string().optional(),
        bpm: z.number().int().min(40).max(240),
        mood: z.string(),
        style: z.string(),
        language: z.string(),
        vocalPreset: z.string(),
        modelLine: z.enum(["O1", "V6", "V7", "V7.5", "V8"]),
        tier: z.enum(["free", "creator", "pro", "studio"]),
        stems: z.boolean(),
        durationSec: z.number().int().min(5).max(240),
      })
    )
    .mutation(async ({ input }) => {
      return fastapiJson("/api/music/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }) as Promise<{ jobId: string; status: string }>;
    }),

  job: t.procedure.input(z.object({ jobId: z.string().min(1) })).query(async ({ input }) => {
    return fastapiJson(`/api/jobs/${encodeURIComponent(input.jobId)}`);
  }),

  /**
   * Same as `job`, plus `wavUrlAbsolute` on mix and stems when `publicOrigin` or `DIETER_PUBLIC_API_ORIGIN` is set.
   * Use the browser-visible API origin (e.g. https://api.example.com or https://app.example.com if /api is same host).
   */
  jobWithPlaybackUrls: t.procedure
    .input(
      z.object({
        jobId: z.string().min(1),
        /** Full origin only (no path), e.g. https://myapp.railway.app */
        publicOrigin: z.string().url().optional(),
      })
    )
    .query(async ({ input }) => {
      const raw = (await fastapiJson(`/api/jobs/${encodeURIComponent(input.jobId)}`)) as Record<string, unknown>;
      const origin = (input.publicOrigin ?? DEFAULT_PUBLIC_ORIGIN).trim();
      if (!origin) return raw;
      const out = raw.output;
      if (raw.status === "succeeded" && out && typeof out === "object") {
        return {
          ...raw,
          output: resolveWavUrlsInOutput(out, origin),
        };
      }
      return raw;
    }),

  /** Proxies to FastAPI `POST /api/mureka/song/generate` (Mureka key in procedure input for browser clients). */
  murekaSongGenerate: t.procedure
    .input(
      z.object({
        lyrics: z.string().default(""),
        model: z.string().default("auto"),
        prompt: z.string().min(1),
        murekaApiKey: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const { murekaApiKey, ...body } = input;
      return fastapiJson("/api/mureka/song/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${murekaApiKey}`,
        },
        body: JSON.stringify({ lyrics: body.lyrics, model: body.model, prompt: body.prompt }),
      });
    }),

  /** Proxies to FastAPI `GET /api/mureka/song/query/:taskId`. */
  murekaSongQuery: t.procedure
    .input(
      z.object({
        taskId: z.string().min(1),
        murekaApiKey: z.string().min(1),
      })
    )
    .query(async ({ input }) => {
      return fastapiJson(`/api/mureka/song/query/${encodeURIComponent(input.taskId)}`, {
        headers: { Authorization: `Bearer ${input.murekaApiKey}` },
      });
    }),

  /** FastAPI `POST /api/lyrics/generate` — OpenAI / Anthropic via server env or optional keys. */
  lyricsGenerate: t.procedure
    .input(
      z.object({
        style: z.string().default(""),
        title: z.string().default(""),
        vocal: z.enum(["female", "male"]),
        openaiApiKey: z.string().optional(),
        anthropicApiKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return fastapiJson("/api/lyrics/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }) as Promise<{ text: string; source: "openai" | "anthropic" | "local"; warnings?: string[] }>;
    }),

  /** FastAPI `POST /api/lyrics/optimize`. */
  lyricsOptimize: t.procedure
    .input(
      z.object({
        lyrics: z.string().min(1),
        openaiApiKey: z.string().optional(),
        anthropicApiKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return fastapiJson("/api/lyrics/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }) as Promise<{ text: string; source: "openai" | "anthropic" | "local"; warnings?: string[] }>;
    }),

  /** FastAPI `GET /api/voices/list` — sample WAVs under ``/voices/man`` and ``/voices/woman``. */
  voicesList: t.procedure.query(async () => {
    return fastapiJson("/api/voices/list") as Promise<{
      man: { name: string; url: string }[];
      woman: { name: string; url: string }[];
    }>;
  }),
});

export type AppRouter = typeof appRouter;

const app = express();
app.use(cors({ origin: true, credentials: false }));
app.use("/trpc", createExpressMiddleware({ router: appRouter }));

app.get("/health", async (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`DIETER tRPC running on http://127.0.0.1:${PORT}/trpc`);
  // eslint-disable-next-line no-console
  console.log(`Proxying FastAPI at ${FASTAPI_BASE}`);
});

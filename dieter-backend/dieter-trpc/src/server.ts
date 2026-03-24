import cors from "cors";
import express from "express";
import { initTRPC } from "@trpc/server";
import { z } from "zod";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

const FASTAPI_BASE = process.env.DIETER_FASTAPI_BASE ?? "http://127.0.0.1:8787";
const PORT = Number(process.env.DIETER_TRPC_PORT ?? 8790);

const t = initTRPC.create();

const appRouter = t.router({
  health: t.procedure.query(async () => {
    const res = await fetch(`${FASTAPI_BASE}/api/health`);
    if (!res.ok) throw new Error(`FastAPI health failed (${res.status})`);
    return (await res.json()) as { ok: boolean; time: number };
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
      const res = await fetch(`${FASTAPI_BASE}/api/music/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`plan failed (${res.status})`);
      return (await res.json()) as unknown;
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
      const res = await fetch(`${FASTAPI_BASE}/api/music/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`generate failed (${res.status})`);
      return (await res.json()) as { jobId: string; status: string };
    }),

  job: t.procedure.input(z.object({ jobId: z.string().min(1) })).query(async ({ input }) => {
    const res = await fetch(`${FASTAPI_BASE}/api/jobs/${encodeURIComponent(input.jobId)}`);
    if (!res.ok) throw new Error(`job poll failed (${res.status})`);
    return (await res.json()) as unknown;
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
      const res = await fetch(`${FASTAPI_BASE}/api/mureka/song/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${murekaApiKey}`,
        },
        body: JSON.stringify({ lyrics: body.lyrics, model: body.model, prompt: body.prompt }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `mureka generate failed (${res.status})`);
      return JSON.parse(text) as unknown;
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
      const res = await fetch(
        `${FASTAPI_BASE}/api/mureka/song/query/${encodeURIComponent(input.taskId)}`,
        {
          headers: { Authorization: `Bearer ${input.murekaApiKey}` },
        }
      );
      const text = await res.text();
      if (!res.ok) throw new Error(text || `mureka query failed (${res.status})`);
      return JSON.parse(text) as unknown;
    }),

  /** FastAPI `POST /api/lyrics/generate` — OpenAI via server env or optional key. */
  lyricsGenerate: t.procedure
    .input(
      z.object({
        style: z.string().default(""),
        title: z.string().default(""),
        vocal: z.enum(["female", "male"]),
        openaiApiKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const res = await fetch(`${FASTAPI_BASE}/api/lyrics/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `lyrics generate failed (${res.status})`);
      return JSON.parse(text) as { text: string; source: "openai" | "local" };
    }),

  /** FastAPI `POST /api/lyrics/optimize`. */
  lyricsOptimize: t.procedure
    .input(
      z.object({
        lyrics: z.string().min(1),
        openaiApiKey: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const res = await fetch(`${FASTAPI_BASE}/api/lyrics/optimize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(text || `lyrics optimize failed (${res.status})`);
      return JSON.parse(text) as { text: string; source: "openai" | "local" };
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


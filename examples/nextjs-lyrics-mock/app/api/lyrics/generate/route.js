/**
 * Next.js App Router — POST /api/lyrics/generate
 * Pure mock (no OpenAI). Copy this tree under your Next.js `app/` folder.
 */
export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { lyrics } = body;

  return Response.json({
    song_url: "/demo-song.mp3",
    lyrics: lyrics || "Drop the bass, feel the rhythm tonight",
    status: "generated",
    voice_id: "male_2",
    duration: 180,
  });
}

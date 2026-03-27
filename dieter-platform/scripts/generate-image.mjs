import { writeFile } from "node:fs/promises";
import Replicate from "replicate";

const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error("Missing REPLICATE_API_TOKEN environment variable.");
  process.exit(1);
}

/** Override with e.g. black-forest-labs/flux-1.1-pro — must exist on Replicate. */
const modelRef = (process.env.REPLICATE_MODEL || "black-forest-labs/flux-schnell").trim();

const replicate = new Replicate({ auth: token });

const input = {
  prompt: process.env.PROMPT || "How engineers see the San Francisco Bridge",
  aspect_ratio: process.env.ASPECT_RATIO || "4:3",
  output_format: (process.env.OUTPUT_FORMAT || "png").replace("jpg", "jpeg"),
  output_quality: Math.min(100, Math.max(1, Number(process.env.OUTPUT_QUALITY) || 90)),
};

try {
  const output = await replicate.run(modelRef, { input });

  const first = Array.isArray(output) ? output[0] : output;
  const fileUrl = typeof first?.url === "function" ? first.url() : first;

  if (!fileUrl || typeof fileUrl !== "string") {
    throw new Error("Model did not return a downloadable file URL.");
  }

  console.log("Output URL:", fileUrl);

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Failed downloading file: HTTP ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const outFile = process.env.OUT_FILE || "output.png";
  await writeFile(outFile, bytes);
  console.log("Saved", outFile);
} catch (error) {
  console.error("Generation failed:", error?.message || error);
  process.exit(1);
}

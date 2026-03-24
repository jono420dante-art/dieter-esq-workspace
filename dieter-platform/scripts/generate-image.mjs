import { writeFile } from "node:fs/promises";
import Replicate from "replicate";

const token = process.env.REPLICATE_API_TOKEN;
if (!token) {
  console.error("Missing REPLICATE_API_TOKEN environment variable.");
  process.exit(1);
}

const replicate = new Replicate({ auth: token });

const input = {
  prompt: "How engineers see the San Francisco Bridge",
  aspect_ratio: "4:3",
  output_format: "png",
};

try {
  const output = await replicate.run("google/nano-banana-pro", { input });

  // Some models return a single file-like object; others return arrays.
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
  await writeFile("output.png", bytes);
  console.log("Saved output.png");
} catch (error) {
  console.error("Generation failed:", error?.message || error);
  process.exit(1);
}

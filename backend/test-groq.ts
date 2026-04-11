import "dotenv/config";
import { env } from "./src/config/env";
import { callLLM } from "./src/services/ai/llmClient";

async function run() {
  console.log("Testing Groq...");
  const res = await callLLM("Say hello world", { maxTokens: 10 });
  console.log("Result:", res);
}

run();

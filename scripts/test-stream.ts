import { streamChatWithOllama } from "../src/lib/ollama";

async function main() {
  console.log("start", new Date().toISOString());
  try {
    const stream = await streamChatWithOllama([
      { role: "user", content: "こんにちは。短く一言で挨拶を返してください。" },
    ]);
    const reader = stream.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      process.stdout.write(value);
    }
  } catch (e) {
    console.error("ERROR:", e);
  }
  console.log("\nend", new Date().toISOString());
}

main();

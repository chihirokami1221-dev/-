const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";
// AIチャットは対話の応答速度を優先し、日記分析・実績抽出より軽いモデルを使う。
const OLLAMA_CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? OLLAMA_MODEL;

export interface OllamaChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export async function chatWithOllama(messages: OllamaChatMessage[]): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, messages, stream: false }),
  });

  if (!res.ok) {
    throw new Error(`Ollama request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.message?.content ?? "";
}

// stream:trueでOllamaから逐次トークンを受け取る。レスポンス全体を待たずに
// 画面へ少しずつ表示できるようにして、体感速度を改善する。
// (Turbopackのapp-routeバンドルでasync function*が正しく動かないため、
//  ReadableStreamのpullコールバックで実装している)
export async function streamChatWithOllama(messages: OllamaChatMessage[]): Promise<ReadableStream<string>> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_CHAT_MODEL,
      messages,
      stream: true,
      // CPUのみで生成速度が遅い(1秒あたり十数トークン)ため、だらだら長文化すると
      // 体感速度が大きく悪化する。上限を設けて長文化を防ぐ。
      options: { num_predict: 400 },
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama request failed: ${res.status} ${await res.text().catch(() => "")}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  return new ReadableStream<string>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const chunk = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
          if (chunk.message?.content) controller.enqueue(chunk.message.content);
          if (chunk.done) {
            controller.close();
            return;
          }
        }

        if (lines.length > 0) return;
      }
    },
  });
}

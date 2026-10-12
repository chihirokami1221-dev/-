import { NextRequest } from "next/server";
import { streamChatWithOllama, type OllamaChatMessage } from "@/lib/ollama";
import { buildChatSystemPrompt } from "@/lib/chatContext";

const MAX_HISTORY = 20;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages = Array.isArray(body?.messages) ? (body.messages as OllamaChatMessage[]) : [];
  const history = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_HISTORY);

  if (history.length === 0) {
    return new Response("メッセージがありません。", { status: 400 });
  }

  const systemPrompt = await buildChatSystemPrompt();
  const fullMessages: OllamaChatMessage[] = [{ role: "system", content: systemPrompt }, ...history];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const upstream = await streamChatWithOllama(fullMessages);
        const reader = upstream.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(encoder.encode(value));
        }
      } catch (e) {
        console.error("[/api/chat] stream error:", e);
        controller.enqueue(
          encoder.encode("\n\n[エラー] ローカルAI(Ollama)に接続できませんでした。`ollama serve` が起動しているか確認してください。"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

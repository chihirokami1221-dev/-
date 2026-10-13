import { NextRequest } from "next/server";
import { streamChatWithOllama, isAiDisabled, type OllamaChatMessage } from "@/lib/ollama";
import { buildChatSystemPrompt } from "@/lib/chatContext";
import { requireAuth, requireSameOrigin } from "@/lib/auth";

const MAX_HISTORY = 20;
const AI_DISABLED_MESSAGE = "AI機能はWeb版では利用できません。ローカル版でご利用ください。";

function aiDisabledStreamResponse() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(AI_DISABLED_MESSAGE));
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

export async function POST(req: NextRequest) {
  const authError = requireAuth(req);
  if (authError) return authError;
  const csrfError = requireSameOrigin(req);
  if (csrfError) return csrfError;
  if (isAiDisabled()) return aiDisabledStreamResponse();

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

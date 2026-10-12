import { ChatPanel } from "@/components/chat/ChatPanel";

export default function ChatPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold text-slate-900">AIチャット</h1>
      <p className="mb-4 text-sm text-slate-500">
        ローカルAI(Ollama)があなたの日記・ロードマップ・実績を踏まえて相談に乗ります。会話はページを離れると消えます。
      </p>
      <ChatPanel />
    </div>
  );
}

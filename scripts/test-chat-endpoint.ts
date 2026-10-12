async function main() {
  const start = Date.now();
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "こんにちは。短く挨拶だけ返して。" }] }),
  });
  if (!res.body) throw new Error("no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let first = true;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (first) {
      console.log(`[最初のチャンク: ${(Date.now() - start) / 1000}秒]`);
      first = false;
    }
    process.stdout.write(decoder.decode(value, { stream: true }));
  }
  console.log(`\n[完了: ${(Date.now() - start) / 1000}秒]`);
}

main();

import { buildChatSystemPrompt } from "../src/lib/chatContext";

async function main() {
  const prompt = await buildChatSystemPrompt();
  console.log(prompt);
  console.log("---");
  console.log("文字数:", prompt.length);
}

main();

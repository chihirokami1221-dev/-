import sharp from "sharp";
import { mkdirSync } from "fs";

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <text x="256" y="300" font-family="'Hiragino Sans','Yu Gothic','Noto Sans JP',sans-serif" font-size="230" font-weight="700" fill="#ffffff" text-anchor="middle">成</text>
</svg>
`;

mkdirSync("public/icons", { recursive: true });

const targets = [
  { file: "public/icons/icon-192.png", size: 192 },
  { file: "public/icons/icon-512.png", size: 512 },
  { file: "public/icons/apple-touch-icon.png", size: 180 },
];

for (const t of targets) {
  await sharp(Buffer.from(svg)).resize(t.size, t.size).png().toFile(t.file);
  console.log("wrote", t.file);
}

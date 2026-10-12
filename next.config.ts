import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // スマホ等、同じTailscaleネットワーク上の別端末からアクセスした際にHMR通信がブロックされ、
  // 再接続を繰り返して画面がリロードし続ける不具合が起きるため、そのオリジンを許可する。
  allowedDevOrigins: ["100.98.207.9"],
  // このアプリは全ページがDBの動的データに依存するため、静的プリレンダリング前提の
  // Cache Components機能は無効化する。
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

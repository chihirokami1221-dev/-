import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "成長OS",
    short_name: "成長OS",
    description: "人生の目標からロードマップ、日々の行動、実績、市場価値までを一つにつなげる個人の成長管理アプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#10b981",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

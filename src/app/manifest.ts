import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Passalong",
    short_name: "Passalong",
    description: "Buy and sell pre-loved fashion and more across the UK.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f1ea",
    theme_color: "#121212",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}

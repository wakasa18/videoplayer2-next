import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Damon's Archive",
    short_name: "Archive",
    description: "Private files, assignments, videos, reminders, and archive tools.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#050812",
    theme_color: "#07101d",
    orientation: "portrait-primary",
    categories: ["productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

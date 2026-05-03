import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const m = {
    name: "Pockaa — Save, Read, Remember",
    short_name: "Pockaa",
    description:
      "Your personal bookmark manager with AI-powered summaries and reader mode",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    orientation: "portrait-primary",
    categories: ["productivity", "utilities"],
    // share_target is part of the W3C Web Share Target spec but isn't in
    // Next.js's MetadataRoute.Manifest type yet, so we cast below.
    share_target: {
      action: "/share",
      method: "GET",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
  return m as MetadataRoute.Manifest;
}

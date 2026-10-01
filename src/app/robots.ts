import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin", "/settings", "/inbox", "/orders", "/checkout", "/wallet", "/sell", "/drafts", "/notifications", "/search?"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

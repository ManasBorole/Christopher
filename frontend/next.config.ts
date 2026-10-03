import type { NextConfig } from "next";

const config: NextConfig = {
  // shared workspace ships raw TS - let Next transpile it.
  transpilePackages: ["@vta/shared"],
  // hide the on-screen dev/build indicator
  devIndicators: false,
  // the landing's baked artwork is requested with ?v=ART_V, so it can be cached for good
  async headers() {
    return [{ source: "/airmail/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] }];
  },
};

export default config;

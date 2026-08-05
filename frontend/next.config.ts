import type { NextConfig } from "next";

const config: NextConfig = {
  // shared workspace ships raw TS - let Next transpile it.
  transpilePackages: ["@vta/shared"],
  // hide the on-screen dev/build indicator
  devIndicators: false,
};

export default config;

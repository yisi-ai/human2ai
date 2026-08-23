import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    useTypeScriptCli: false,
  },
  transpilePackages: ["@human2ai/ui"],
};

export default config;

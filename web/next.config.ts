import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const baseConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: false,
  },
  transpilePackages: ["@human2ai/ui"],
};

export default function config(phase: string): NextConfig {
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    const serviceUrl =
      process.env.HUMAN2AI_SERVER_URL ??
      `http://127.0.0.1:${process.env.HUMAN2AI_PORT ?? "4179"}`;
    return {
      ...baseConfig,
      async rewrites() {
        return [
          {
            source: "/api/v1/:path*",
            destination: `${serviceUrl}/api/v1/:path*`,
          },
        ];
      },
    };
  }

  return {
    ...baseConfig,
    output: "export",
    trailingSlash: true,
  };
}

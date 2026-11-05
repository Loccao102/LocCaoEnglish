import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  // The Windows addon loads adjacent libvips DLLs that automatic tracing omits.
  ...(process.platform === "win32" && process.arch === "x64" ? {
    outputFileTracingIncludes: {
      "/*": ["./node_modules/@img/sharp-win32-x64/lib/*.dll"],
    },
  } : {}),
};

export default nextConfig;

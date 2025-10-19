import type { Config } from "@react-router/dev/config";

export default {
  // Disable SSR to improve Bun compatibility and avoid Node-specific streaming APIs.
  // Production server will serve the SPA build with a graceful fallback.
  ssr: false,
} satisfies Config;

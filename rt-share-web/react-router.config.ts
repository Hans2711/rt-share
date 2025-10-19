import type { Config } from "@react-router/dev/config";

export default {
  // Enable SSR; custom app/entry.server.tsx uses React 19's
  // renderToReadableStream for Bun compatibility.
  ssr: true,
} satisfies Config;

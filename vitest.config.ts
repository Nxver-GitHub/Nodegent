import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex/__tests__/**/*.test.ts", "src/**/__tests__/**/*.test.{ts,tsx}"],
    environment: "edge-runtime",
    server: {
      deps: {
        inline: ["convex-test"],
      },
    },
    coverage: {
      provider: "v8",
      include: ["convex/**/*.ts"],
      exclude: ["convex/_generated/**", "convex/__tests__/**"],
    },
  },
});

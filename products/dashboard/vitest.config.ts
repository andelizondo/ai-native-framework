import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    // Default environment is jsdom (component + unit tests).
    // API route tests override this per-file with @vitest-environment node.
    environment: "jsdom",
    setupFiles: ["./tests/setup.tsx"],
    exclude: ["node_modules", ".next", "e2e/**", "**/*.spec.ts", "**/*.spec.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: ["node_modules", ".next", "e2e", "tests/msw", "*.config.*"],
    },
  },
});

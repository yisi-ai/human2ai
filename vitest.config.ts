import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // Real CPU rendering and API/CLI workflows need headroom on slower CI runners.
    testTimeout: 30_000,
    // Bound concurrent CPU-heavy software rendering across test files.
    maxWorkers: 2,
    include: ["test/**/*.test.ts", "web/**/*.test.ts"],
  },
});

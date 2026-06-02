import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/e2e/**/*.test.ts"],
    hookTimeout: 180000,
    testTimeout: 1800000,
    fileParallelism: false,
  },
});

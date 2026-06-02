import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@kyonru/zustand-inspector": path.resolve(
        __dirname,
        "./packages/zustand-inspector/src",
      ),
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    setupFiles: ["./tests/setup/vitest.ts"],
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    testTimeout: 10000,
  },
});

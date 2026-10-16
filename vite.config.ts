import { defineConfig } from "vite";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname);

export default defineConfig({
  test: {
    root: repoRoot,
    include: ["tests/**/*.test.ts", "packages/**/src/**/*.test.ts"],
    environment: "node",
  },
  root: resolve(repoRoot, "site"),
  base: process.env.NV_BASE ?? "/",
  build: {
    target: "es2022",
    outDir: resolve(repoRoot, "dist"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@nv/engine": resolve(repoRoot, "packages/engine/src/index.ts"),
      "@nv/game": resolve(repoRoot, "packages/game/src/index.ts"),
      "@nv/schema": resolve(repoRoot, "packages/schema/src/index.ts"),
    },
  },
});

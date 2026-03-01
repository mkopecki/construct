import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "service-worker": "src/service-worker.ts",
    "content-script": "src/content-script.ts",
    popup: "src/popup.ts",
  },
  outDir: "dist",
  format: "iife",
  clean: true,
  splitting: false,
  sourcemap: false,
  outExtension: () => ({ js: ".js" }),
});

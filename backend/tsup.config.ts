import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  // express/prisma/zod stay external and resolve from node_modules at runtime.
  clean: true,
  sourcemap: true,
});

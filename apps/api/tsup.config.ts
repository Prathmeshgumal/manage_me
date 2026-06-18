import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  // Inline the workspace package (it ships as TS source) so the
  // production bundle has no unresolved .ts imports. express/prisma/zod
  // stay external and resolve from node_modules at runtime.
  noExternal: ["@myschedule/shared"],
  clean: true,
  sourcemap: true,
});

import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    environment: "node",
    // The dev/test database is a remote Supabase pooler; each query is a round-trip,
    // and scrypt hashing is CPU-bound, so give tests generous timeouts. Run test
    // files serially since they share one database and clear tables in beforeEach.
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
